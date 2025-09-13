/**
 * Visual SCXML Template
 * 
 * Sample SCXML document with visual metadata to demonstrate the visual namespace features
 */

export const VISUAL_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml"
       xmlns:visual="http://visual-scxml-editor/metadata"
       version="1.0" 
       initial="idle"
       visual:viewport="0,0,800,600"
       visual:zoom="1.0">
  
  <!-- Idle State - Blue theme -->
  <state id="idle"
         visual:x="100"
         visual:y="100"
         visual:width="140"
         visual:height="80"
         visual:fill="#e1f5fe"
         visual:stroke="#0277bd"
         visual:stroke-width="2"
         visual:border-radius="8">
    <onentry>
      <log label="Traffic Light" expr="'Red - Stop for 5 seconds'" />
      <send event="next" delay="5s"/>
    </onentry>
    
    <!-- Transition with waypoints -->
    <transition event="start" 
                target="processing"
                visual:waypoints="240,140 320,140"
                visual:label-offset="0,-20"
                visual:curve-type="smooth" />
  </state>

  <!-- Processing State - Green theme with custom actions -->
  <state id="processing"
         visual:x="400"
         visual:y="100"
         visual:width="160"
         visual:height="80"
         visual:fill="#e8f5e8"
         visual:stroke="#2e7d32"
         visual:stroke-width="2"
         visual:action-namespaces="customTasks,utilities">
    <onentry>
      <log label="State" expr="'Processing started'" />
    </onentry>
    
    <transition event="complete" 
                target="completed"
                visual:curve-type="step" />
    <transition event="error" 
                target="error"
                visual:curve-type="smooth"
                visual:stroke="#d32f2f" />
  </state>

  <!-- Completed State - Success theme -->
  <state id="completed"
         visual:x="400"
         visual:y="250"
         visual:width="140"
         visual:height="80"
         visual:fill="#e8f9e8"
         visual:stroke="#4caf50"
         visual:stroke-width="3">
    <onentry>
      <log label="State" expr="'Task completed successfully'" />
    </onentry>
    
    <transition event="reset" 
                target="idle"
                visual:waypoints="340,290 240,290 140,250 140,180"
                visual:curve-type="smooth" />
  </state>

  <!-- Error State - Error theme -->
  <state id="error"
         visual:x="650"
         visual:y="100"
         visual:width="120"
         visual:height="80"
         visual:fill="#ffebee"
         visual:stroke="#f44336"
         visual:stroke-width="2"
         visual:opacity="0.9">
    <onentry>
      <log label="Error" expr="'An error occurred'" />
    </onentry>
    
    <transition event="retry" 
                target="processing"
                visual:curve-type="bezier"
                visual:waypoints="650,140 560,140" />
    <transition event="reset" 
                target="idle"
                visual:waypoints="650,140 650,50 400,50 140,90 140,140"
                visual:curve-type="smooth" />
  </state>

  <!-- Data model with visual metadata -->
  <datamodel visual:collapsed="false">
    <data id="counter" expr="0" />
    <data id="errorCount" expr="0" />
    <data id="lastProcessedItem" expr="null" />
  </datamodel>

</scxml>`;

export const SIMPLE_VISUAL_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml"
       xmlns:visual="http://visual-scxml-editor/metadata"
       version="1.0" 
       initial="start">

  <state id="start"
         visual:x="100"
         visual:y="100"
         visual:fill="#e3f2fd"
         visual:stroke="#1976d2">
    <transition event="go" 
                target="end"
                visual:curve-type="smooth" />
  </state>

  <final id="end"
         visual:x="300"
         visual:y="100"
         visual:fill="#e8f5e8"
         visual:stroke="#388e3c" />

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