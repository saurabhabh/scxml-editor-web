export const DEFAULT_SCXML_TEMPLATE = `<scxml xmlns="http://www.w3.org/2005/07/scxml" xmlns:viz="http://visual-scxml-editor/metadata" version="1.0" datamodel="ecmascript" name="fa_argon">
  <datamodel>
    <data expr="0.0" id="ArgonLine_bar"/>
  </datamodel>
  <state id="boot_up" viz:xywh="-1342,-712,160,80">
    <transition event="cmd:loop open || Oxygen &gt; 19%" target="loop_open" viz:waypoints="-1285,-572;-1355,-546"/>
    <transition event="cmd: loop_close" target="loop_closed" viz:waypoints="-1214,-573;-1048,-536"/>
  </state>
  <state id="loop_open" viz:xywh="-1451,-496,160,80"/>
  <state id="loop_closed" initial="hal_1" viz:xywh="-1115,-462,188,82">
    <state id="hal_1" viz:xywh="-220,50,160,80">
      <transition event="cmd: hal3" target="hal_3" viz:sourceHandle="right" viz:targetHandle="left"/>
    </state>
    <state id="hal_3" viz:xywh="97,51,160,80" initial="not_connected">
      <state id="check_cooling_water" viz:xywh="-246,554,266,80">
        <transition event="event" target="check_chiller"/>
      </state>
      <state id="check_power" viz:xywh="-222,146,208,89">
        <transition event="event" target="check_argon"/>
      </state>
      <state id="not_connected" viz:xywh="-244,-112,251,82">
        <transition event="event" target="check_server_connection"/>
      </state>
      <state id="check_chiller" viz:xywh="-233,704,213,80">
        <transition event="event" target="self_check"/>
      </state>
      <state id="check_server_connection" viz:xywh="-270,23,305,70">
        <transition event="event" target="check_power"/>
      </state>
      <state id="fully_connected" initial="syste_ready" viz:xywh="201,422,215,82">
        <state id="system_ready" viz:xywh="-373,-2,213,77">
          <transition event="event" target="purge" viz:waypoints="-268,106;-299,150"/>
          <transition event="event" target="heat&amp;purge" viz:waypoints="-231,110;-88,129"/>
        </state>
        <state id="purge" viz:xywh="-390,172,160,80"/>
        <state id="heat&amp;purge" viz:xywh="-162,187,180,82">
          <transition event="event" target="ready_to_pump"/>
        </state>
        <state id="ready_to_pump" initial="ready" viz:xywh="-254,339,210,85">
          <state id="pumping" initial="pumping_internal" viz:xywh="170,306,160,80">
            <state id="pumping_internal" viz:xywh="-191,-13,281,80">
              <transition event="cmd: pump_external" target="pumping_external" viz:sourceHandle="bottom" viz:targetHandle="top"/>
              <transition event="cmd:take_sample" target="take_online_sample" viz:sourceHandle="right" viz:targetHandle="left"/>
            </state>
            <state id="pumping_external" viz:xywh="-195,160,243,80">
              <transition event="cmd: pump_internal" target="pumping_internal" viz:sourceHandle="left" viz:targetHandle="left"/>
              <transition event="cmd:take_sample" target="take_online_sample" viz:sourceHandle="right" viz:targetHandle="left"/>
            </state>
            <state id="take_online_sample" viz:xywh="238,84,256,70"/>
            <transition event="cmd:deprime" target="deprime" viz:sourceHandle="right" viz:targetHandle="left"/>
          </state>
          <state id="prime_pump" viz:xywh="-167,265,202,79">
            <transition event="" target="pumping" viz:sourceHandle="right" viz:targetHandle="left"/>
          </state>
          <state id="deprime" viz:xywh="475,248,160,80">
            <transition event="" target="ready" viz:sourceHandle="right" viz:targetHandle="right"/>
          </state>
          <state id="ready" viz:xywh="-3,74,184,80">
            <transition event="cmd:pump" target="prime_pump"/>
          </state>
          <transition event="Leak_* = 1" target="leak_detected"/>
          <transition event="filter_flow &lt; 0.1" target="salt_filter_blocked"/>
        </state>
        <state id="leak_detected" viz:xywh="82,363,202,85"/>
        <state id="salt_filter_blocked" viz:xywh="82,547,233,85"/>
      </state>
      <state id="check_argon" viz:xywh="-196,278,160,80">
        <transition event="event" target="check_nitrogen"/>
      </state>
      <state id="check_nitrogen" viz:xywh="-223,413,218,82">
        <transition event="event" target="check_cooling_water"/>
      </state>
      <state id="self_check" initial="check_all_heaters" viz:xywh="218,212,175,82">
        <state id="check_all_heaters" viz:xywh="-183,-122,160,80">
          <transition event="event" target="check_temp_to_heaters"/>
        </state>
        <state id="check_temp_to_heaters" viz:xywh="-210,7,160,80">
          <transition event="event" target="check_gas_leak_rate"/>
        </state>
        <state id="check_gas_leak_rate" viz:xywh="-178,129,160,80">
          <transition event="event" target="check_soft_valve"/>
        </state>
        <state id="check_soft_valve" viz:xywh="-189,247,160,80"/>
        <transition event="event" target="fully_connected"/>
        <transition event="event" target="gas_filter_blocked"/>
      </state>
      <state id="gas_filter_blocked" viz:xywh="525,226,236,68"/>
      <transition event="cmd: hal1" target="hal_1" viz:sourceHandle="bottom" viz:targetHandle="bottom"/>
    </state>
  </state>
  <state id="Emergency_stop" initial="gas_safestate" viz:xywh="-998,-764,319,128">
    <state id="gas_safestate" viz:xywh="-163,-81,235,81">
      <transition event="" target="stop_pump" viz:sourceHandle="bottom" viz:targetHandle="top"/>
    </state>
    <state id="stop_pump" viz:xywh="-135,91,184,83">
      <transition event="" target="heaters_off" viz:sourceHandle="bottom" viz:targetHandle="top"/>
    </state>
    <state id="heaters_off" viz:xywh="-136,266,189,82"/>
    <transition event="event" target="boot_up" viz:sourceHandle="left" viz:targetHandle="top"/>
  </state>
</scxml>`;
