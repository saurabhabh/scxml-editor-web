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
      parseAttributeValue: false,
      trimValues: true,
      parseTagValue: true,
    });
  }

  parse(xmlContent: string): ParseResult<SCXMLDocument> {
    const errors: ValidationError[] = [];
    let parsed: Record<string, unknown> | null = null;
    let hasXMLError = false;

    // First perform comprehensive XML syntax validation
    const xmlSyntaxErrors = this.validateXMLSyntax(xmlContent);
    errors.push(...xmlSyntaxErrors);
    hasXMLError = xmlSyntaxErrors.some(e => e.severity === 'error');

    // Also run fast-xml-parser validation for additional checks
    const validationResult = XMLValidator.validate(xmlContent);
    if (validationResult !== true) {
      // Only add this error if we haven't already found it
      const isDuplicate = xmlSyntaxErrors.some(err => 
        err.line === validationResult.err.line && 
        err.column === validationResult.err.col
      );
      
      if (!isDuplicate) {
        errors.push({
          message: validationResult.err.msg,
          line: validationResult.err.line,
          column: validationResult.err.col,
          severity: 'error',
          code: validationResult.err.code,
        });
        hasXMLError = true;
      }
    }

    // Only try to parse if XML is valid
    if (!hasXMLError) {
      try {
        parsed = this.parser.parse(xmlContent);
      } catch (error) {
        errors.push({
          message:
            error instanceof Error ? error.message : 'Unknown parsing error',
          severity: 'error',
        });
        hasXMLError = true;
      }
    }

    // Check if root element is scxml (only if parsing was successful)
    if (parsed && !parsed.scxml) {
      errors.push({
        message: 'Root element must be <scxml>',
        severity: 'error',
      });
    }

    // Create SCXML document if we have valid structure
    let scxmlDoc: SCXMLDocument | undefined;
    if (parsed && parsed.scxml) {
      scxmlDoc = {
        scxml: parsed.scxml as SCXMLElement,
      };

      // Perform SCXML-specific validation even if there were XML errors
      this.validateSCXML(scxmlDoc.scxml, errors);
    }

    return {
      success: errors.filter((e) => e.severity === 'error').length === 0,
      data: scxmlDoc,
      errors,
    };
  }

  private validateXMLSyntax(xmlContent: string): ValidationError[] {
    const errors: ValidationError[] = [];
    const lines = xmlContent.split('\n');
    
    // Track parsing state
    const tagStack: Array<{name: string, line: number, col: number}> = [];
    let inCDATA = false;
    let inComment = false;
    let inProcessingInstruction = false;
    let hasIncompleteTag = false;
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      
      for (let charIndex = 0; charIndex < line.length; charIndex++) {
        const char = line[charIndex];
        const remaining = line.slice(charIndex);
        
        // Handle CDATA sections
        if (!inComment && !inProcessingInstruction) {
          if (remaining.startsWith('<![CDATA[')) {
            inCDATA = true;
            charIndex += 8; // Skip past '<![CDATA['
            continue;
          }
          if (inCDATA && remaining.startsWith(']]>')) {
            inCDATA = false;
            charIndex += 2; // Skip past ']]>'
            continue;
          }
        }
        
        // Handle comments
        if (!inCDATA && !inProcessingInstruction) {
          if (remaining.startsWith('<!--')) {
            inComment = true;
            charIndex += 3; // Skip past '<!--'
            continue;
          }
          if (inComment && remaining.startsWith('-->')) {
            inComment = false;
            charIndex += 2; // Skip past '-->'
            continue;
          }
        }
        
        // Handle processing instructions
        if (!inCDATA && !inComment) {
          if (remaining.startsWith('<?')) {
            inProcessingInstruction = true;
            charIndex += 1; // Skip past '<?'
            continue;
          }
          if (inProcessingInstruction && remaining.startsWith('?>')) {
            inProcessingInstruction = false;
            charIndex += 1; // Skip past '?>'
            continue;
          }
        }
        
        // Skip if we're inside special sections
        if (inCDATA || inComment || inProcessingInstruction) {
          continue;
        }
        
        // Check for tag boundaries
        if (char === '<') {
          const tagMatch = remaining.match(/^<\/?([a-zA-Z][a-zA-Z0-9:\-_]*)/);
          if (tagMatch) {
            const isClosingTag = tagMatch[0].startsWith('</');
            const tagName = tagMatch[1];
            
            if (isClosingTag) {
              // Check if closing tag matches most recent opening tag
              if (tagStack.length === 0) {
                errors.push({
                  message: `Unexpected closing tag '</${tagName}>'`,
                  line: lineNumber,
                  column: charIndex + 1,
                  severity: 'error'
                });
              } else {
                const lastTag = tagStack[tagStack.length - 1];
                if (lastTag.name !== tagName) {
                  errors.push({
                    message: `Mismatched closing tag '</${tagName}>' - expected '</${lastTag.name}>'`,
                    line: lineNumber,
                    column: charIndex + 1,
                    severity: 'error'
                  });
                } else {
                  tagStack.pop();
                }
              }
            } else {
              // Check if it's a self-closing tag
              const fullTagMatch = remaining.match(/^<[^>]*\/>/);
              if (!fullTagMatch) {
                // It's an opening tag
                tagStack.push({
                  name: tagName,
                  line: lineNumber,
                  col: charIndex + 1
                });
              }
            }
          }
          
          // Find the end of this tag
          const tagEndIndex = remaining.indexOf('>');
          if (tagEndIndex === -1) {
            // Check if this is at the end of the document - might be incomplete typing
            const remainingContent = xmlContent.slice(xmlContent.indexOf(remaining));
            const isAtEnd = remainingContent.trim() === remaining.trim();
            
            if (isAtEnd) {
              // This might be incomplete typing, mark as potentially incomplete
              hasIncompleteTag = true;
            } else {
              errors.push({
                message: 'Unclosed tag - missing \'>\'',
                line: lineNumber,
                column: charIndex + 1,
                severity: 'error'
              });
            }
          } else {
            // Check for malformed attributes within the tag
            const tagContent = remaining.slice(0, tagEndIndex + 1);
            const attrErrors = this.validateAttributes(tagContent, lineNumber, charIndex + 1);
            errors.push(...attrErrors);
            
            // Skip past this tag
            charIndex += tagEndIndex;
          }
        }
        
        // Check for unescaped special characters in text content
        else if (['&'].includes(char)) {
          const entityMatch = remaining.match(/^&([a-zA-Z][a-zA-Z0-9]*|#[0-9]+|#x[0-9a-fA-F]+);/);
          if (!entityMatch) {
            errors.push({
              message: `Unescaped special character '${char}' - use entity reference`,
              line: lineNumber,
              column: charIndex + 1,
              severity: 'error'
            });
          }
        }
      }
    }
    
    // Only report unclosed tags if the document appears complete
    // (no incomplete tags detected and content is properly structured)
    if (!hasIncompleteTag && tagStack.length > 0) {
      // Check if the last line might be incomplete typing
      const lastLine = lines[lines.length - 1];
      const endsWithIncompleteTag = /<[^>]*$/.test(lastLine.trim());
      
      if (!endsWithIncompleteTag) {
        for (const unclosedTag of tagStack) {
          errors.push({
            message: `Unclosed tag '<${unclosedTag.name}>'`,
            line: unclosedTag.line,
            column: unclosedTag.col,
            severity: 'error'
          });
        }
      }
    }
    
    return errors;
  }

  private validateAttributes(tagContent: string, line: number, column: number): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Find all attribute-like patterns
    const attrRegex = /([a-zA-Z][a-zA-Z0-9:\-_]*)\s*=\s*("[^"]*"|'[^']*'|[^>\s]*)/g;
    const quotedAttrRegex = /([a-zA-Z][a-zA-Z0-9:\-_]*)\s*=\s*("[^"]*"|'[^']*')/g;
    
    // Check for unquoted attribute values
    let match;
    while ((match = attrRegex.exec(tagContent)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      
      if (!attrValue.startsWith('"') && !attrValue.startsWith("'")) {
        errors.push({
          message: `Attribute '${attrName}' value must be quoted`,
          line: line,
          column: column + match.index,
          severity: 'error'
        });
      }
    }
    
    // Check for duplicate attributes
    const foundAttrs = new Set<string>();
    attrRegex.lastIndex = 0;
    while ((match = quotedAttrRegex.exec(tagContent)) !== null) {
      const attrName = match[1].toLowerCase();
      if (foundAttrs.has(attrName)) {
        errors.push({
          message: `Duplicate attribute '${match[1]}'`,
          line: line,
          column: column + match.index,
          severity: 'error'
        });
      }
      foundAttrs.add(attrName);
    }
    
    return errors;
  }

  private validateSCXML(scxml: SCXMLElement, errors: ValidationError[]): void {
    // Basic structure validation - more comprehensive validation is done by SCXMLValidator
    // Just check for critical structural issues here

    if (!scxml['@_name'] && !scxml['@_initial'] && !scxml.state) {
      errors.push({
        message:
          'SCXML must have either a name attribute, initial attribute, or at least one state',
        severity: 'warning',
      });
    }
  }

  serialize(scxmlDoc: SCXMLDocument): string {
    // This is a simplified serialization
    // In a real implementation, you might want to use a proper XML builder
    return this.serializeElement('scxml', scxmlDoc.scxml);
  }

  private serializeElement(tagName: string, element: Record<string, unknown> | SCXMLElement): string {
    const elementObj = element as Record<string, unknown>;
    const attributes = Object.keys(elementObj)
      .filter((key) => key.startsWith('@_'))
      .map((key) => `${key.substring(2)}="${elementObj[key]}"`)
      .join(' ');

    const attributeStr = attributes ? ` ${attributes}` : '';

    // Handle text content
    if (elementObj['#text']) {
      return `<${tagName}${attributeStr}>${elementObj['#text']}</${tagName}>`;
    }

    // Handle child elements
    const children = Object.keys(elementObj)
      .filter((key) => !key.startsWith('@_') && key !== '#text')
      .map((key) => {
        const value = elementObj[key];
        if (Array.isArray(value)) {
          return value.map((v) => this.serializeElement(key, v as Record<string, unknown>)).join('');
        } else {
          return this.serializeElement(key, value as Record<string, unknown>);
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
