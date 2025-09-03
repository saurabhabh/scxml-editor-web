import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { SCXMLDocument, SCXMLElement } from '@/types/scxml';
import type { ValidationError, ParseResult } from '@/types/common';

export class SCXMLParser {
  private parser: XMLParser;
  
  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true,
      trimValues: true,
      parseTrueNumberOnly: false,
      parseTagValue: true,
    });
  }

  parse(xmlContent: string): ParseResult<SCXMLDocument> {
    const errors: ValidationError[] = [];
    
    // First validate XML syntax
    const validationResult = XMLValidator.validate(xmlContent);
    if (validationResult !== true) {
      errors.push({
        message: validationResult.err.msg,
        line: validationResult.err.line,
        column: validationResult.err.col,
        severity: 'error',
        code: validationResult.err.code
      });
      return { success: false, errors };
    }

    try {
      const parsed = this.parser.parse(xmlContent);
      
      // Check if root element is scxml
      if (!parsed.scxml) {
        errors.push({
          message: 'Root element must be <scxml>',
          severity: 'error'
        });
        return { success: false, errors };
      }

      const scxmlDoc: SCXMLDocument = {
        scxml: parsed.scxml as SCXMLElement
      };

      // Perform SCXML-specific validation
      this.validateSCXML(scxmlDoc.scxml, errors);

      return {
        success: errors.filter(e => e.severity === 'error').length === 0,
        data: scxmlDoc,
        errors
      };
    } catch (error) {
      errors.push({
        message: error instanceof Error ? error.message : 'Unknown parsing error',
        severity: 'error'
      });
      return { success: false, errors };
    }
  }

  private validateSCXML(scxml: SCXMLElement, errors: ValidationError[]): void {
    // Validate required attributes
    if (!scxml['@_name'] && !scxml['@_initial'] && !scxml.state) {
      errors.push({
        message: 'SCXML must have either a name attribute, initial attribute, or at least one state',
        severity: 'warning'
      });
    }

    // Validate states have IDs
    if (scxml.state) {
      const states = Array.isArray(scxml.state) ? scxml.state : [scxml.state];
      states.forEach((state, index) => {
        if (!state['@_id']) {
          errors.push({
            message: `State at index ${index} must have an id attribute`,
            severity: 'error'
          });
        }
      });
    }

    // Validate parallel states have IDs
    if (scxml.parallel) {
      const parallels = Array.isArray(scxml.parallel) ? scxml.parallel : [scxml.parallel];
      parallels.forEach((parallel, index) => {
        if (!parallel['@_id']) {
          errors.push({
            message: `Parallel state at index ${index} must have an id attribute`,
            severity: 'error'
          });
        }
      });
    }

    // Validate final states have IDs
    if (scxml.final) {
      const finals = Array.isArray(scxml.final) ? scxml.final : [scxml.final];
      finals.forEach((final, index) => {
        if (!final['@_id']) {
          errors.push({
            message: `Final state at index ${index} must have an id attribute`,
            severity: 'error'
          });
        }
      });
    }
  }

  serialize(scxmlDoc: SCXMLDocument): string {
    // This is a simplified serialization
    // In a real implementation, you might want to use a proper XML builder
    return this.serializeElement('scxml', scxmlDoc.scxml);
  }

  private serializeElement(tagName: string, element: any): string {
    const attributes = Object.keys(element)
      .filter(key => key.startsWith('@_'))
      .map(key => `${key.substring(2)}="${element[key]}"`)
      .join(' ');

    const attributeStr = attributes ? ` ${attributes}` : '';
    
    // Handle text content
    if (element['#text']) {
      return `<${tagName}${attributeStr}>${element['#text']}</${tagName}>`;
    }

    // Handle child elements
    const children = Object.keys(element)
      .filter(key => !key.startsWith('@_') && key !== '#text')
      .map(key => {
        const value = element[key];
        if (Array.isArray(value)) {
          return value.map(v => this.serializeElement(key, v)).join('');
        } else {
          return this.serializeElement(key, value);
        }
      })
      .join('');

    if (children) {
      return `<${tagName}${attributeStr}>${children}</${tagName}>`;
    } else {
      return `<${tagName}${attributeStr} />`;
    }
  }
}