export const DEFAULT_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:viz="http://visual-scxml-editor/metadata" version="1.0" datamodel="ecmascript" name="fa_argon">
  <datamodel>
    <data expr="0.0" id="ArgonLine_bar"></data>
  </datamodel>
  <state id="boot_up" viz:xywh="-1342,-712,160,80">
    <transition event="event" target="loop_open"></transition>
    <transition event="event" target="loop_closed"></transition>
  </state>
  <state id="loop_open" viz:xywh="-1451,-496,160,80"></state>
  <state id="loop_closed" initial="hal_1" viz:xywh="-1115,-460,160,80">
    <state id="hal_1" viz:xywh="-220,50,160,80">
      <transition event="event" target="hal_3"></transition>
    </state>
    <state id="hal_3" viz:xywh="97,51,160,80" initial="not_connected">
      <state id="check_cooling_water" viz:xywh="-264,565,160,80">
        <transition event="event" target="check_chiller"></transition>
      </state>
      <state id="check_power" viz:xywh="-223,148,160,80">
        <transition event="event" target="check_argon"></transition>
      </state>
      <state id="not_connected" viz:xywh="-217,-110,160,80">
        <transition event="event" target="check_server_connection"></transition>
      </state>
      <state id="check_chiller" viz:xywh="-233,704,160,80">
        <transition event="event" target="self_check"></transition>
      </state>
      <state id="check_server_connection" viz:xywh="-268,21,160,80">
        <transition event="event" target="check_power"></transition>
      </state>
      <state id="fully_connected" initial="syste_ready" viz:xywh="201,424,160,80">
        <state id="system_ready" viz:xywh="-373,-5,160,80">
          <transition event="event" target="purge"></transition>
          <transition event="event" target="heat&amp;purge"></transition>
        </state>
        <state id="purge" viz:xywh="-390,172,160,80"></state>
        <state id="heat&amp;purge" viz:xywh="-162,189,160,80">
          <transition event="event" target="ready_to_pump"></transition>
        </state>
        <state id="ready_to_pump" initial="ready" viz:xywh="-254,344,160,80">
          <state id="pumping" initial="pumping_internal" viz:xywh="170,306,160,80">
            <state id="pumping_internal" viz:xywh="-191,-13,160,80"></state>
            <state id="pumping_external" viz:xywh="-195,160,160,80"></state>
            <state id="take_online_sample" viz:xywh="198,63,160,80"></state>
            <transition event="event" target="deprime"></transition>
          </state>
          <state id="prime_pump" viz:xywh="-167,264,160,80">
            <transition event="event" target="pumping"></transition>
          </state>
          <state id="deprime" viz:xywh="488,167,160,80">
            <transition event="event" target="ready"></transition>
          </state>
          <state id="ready" viz:xywh="-3,74,160,80">
            <transition event="event" target="prime_pump"></transition>
          </state>
          <transition event="event" target="leak_detected"></transition>
          <transition event="event" target="salt_filter_blocked"></transition>
        </state>
        <state id="leak_detected" viz:xywh="82,368,160,80"></state>
        <state id="salt_filter_blocked" viz:xywh="82,552,160,80"></state>
      </state>
      <state id="check_argon" viz:xywh="-221,271,160,80">
        <transition event="event" target="check_nitrogen"></transition>
      </state>
      <state id="check_nitrogen" viz:xywh="-236,411,160,80">
        <transition event="event" target="check_cooling_water"></transition>
      </state>
      <state id="self_check" initial="check_all_heaters" viz:xywh="218,214,160,80">
        <state id="check_all_heaters" viz:xywh="-183,-122,160,80">
          <transition event="event" target="check_temp_to_heaters"></transition>
        </state>
        <state id="check_temp_to_heaters" viz:xywh="-210,7,160,80">
          <transition event="event" target="check_gas_leak_rate"></transition>
        </state>
        <state id="check_gas_leak_rate" viz:xywh="-178,129,160,80">
          <transition event="event" target="check_soft_valve"></transition>
        </state>
        <state id="check_soft_valve" viz:xywh="-189,247,160,80"></state>
        <transition event="event" target="fully_connected"></transition>
        <transition event="event" target="gas_filter_blocked"></transition>
      </state>
      <state id="gas_filter_blocked" viz:xywh="525,233,160,80"></state>
    </state>
  </state>
  <state id="Emergency_stop" initial="gas_safestate" viz:xywh="-1036,-782,160,80">
    <state id="gas_safestate" viz:xywh="-163,-80,160,80"></state>
    <state id="stop_pump" viz:xywh="-155,47,160,80"></state>
    <state id="heaters_off" viz:xywh="-159,184,160,80"></state>
    <transition event="event" target="boot_up"></transition>
  </state>
</scxml>`;
