/**
 * Visual SCXML Template
 * 
 * Sample SCXML document with visual metadata to demonstrate the visual namespace features
 */

export const VISUAL_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml"
       xmlns:viz="http://visual-scxml-editor/metadata"
       version="1.0"
       initial="idle">

  <!-- Idle State -->
  <state id="idle"
         viz:xywh="100 100 140 80"
         viz:rgb="#e1f5fe">
    <onentry>
      <log label="Traffic Light" expr="'Red - Stop for 5 seconds'" />
      <send event="next" delay="5s"/>
    </onentry>

    <transition event="start"
                target="processing" />
  </state>

  <!-- Processing State -->
  <state id="processing"
         viz:xywh="400 100 160 80"
         viz:rgb="#e8f5e8">
    <onentry>
      <log label="State" expr="'Processing started'" />
    </onentry>

    <transition event="complete"
                target="completed" />
    <transition event="error"
                target="error" />
  </state>

  <!-- Completed State -->
  <state id="completed"
         viz:xywh="400 250 140 80"
         viz:rgb="#e8f9e8">
    <onentry>
      <log label="State" expr="'Task completed successfully'" />
    </onentry>

    <transition event="reset"
                target="idle" />
  </state>

  <!-- Error State -->
  <state id="error"
         viz:xywh="650 100 120 80"
         viz:rgb="#ffebee">
    <onentry>
      <log label="Error" expr="'An error occurred'" />
    </onentry>

    <transition event="retry"
                target="processing" />
    <transition event="reset"
                target="idle" />
  </state>

  <!-- Data model -->
  <datamodel>
    <data id="counter" expr="0" />
    <data id="errorCount" expr="0" />
    <data id="lastProcessedItem" expr="null" />
  </datamodel>

</scxml>`;

export const SIMPLE_VISUAL_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml"
       xmlns:viz="http://visual-scxml-editor/metadata"
       version="1.0"
       initial="start">

  <state id="start"
         viz:xywh="100 100 120 60"
         viz:rgb="#e3f2fd">
    <transition event="go"
                target="end" />
  </state>

  <final id="end"
         viz:xywh="300 100 120 60"
         viz:rgb="#e8f5e8" />

</scxml>`;

/**
 * Get sample SCXML templates
 */
export function getVisualSCXMLTemplates() {
  return {
    complex: {
      name: 'State Machine with Visual Layout',
      description: 'Complete example with visual positioning, styling, and waypoints',
      content: VISUAL_SCXML_TEMPLATE,
    },
    simple: {
      name: 'Simple Visual State Machine',
      description: 'Basic two-state machine with visual metadata',
      content: SIMPLE_VISUAL_SCXML_TEMPLATE,
    },
  };
}