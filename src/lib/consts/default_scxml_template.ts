export const DEFAULT_SCXML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" name="lp_floworifices">
	<datamodel>
		<data expr="false" id="lp_ao_main_pump_run" />
		<data expr="false" id="lp_ao_pump_api_deprime" />
		<data expr="false" id="lp_ao_pump_status_sensor_zeroing" />
		<data expr="0.0" id="sensorIn" />
		<data expr="0.0" id="sensorOut" />
		<data expr="0" id="lp_floworifices_id" />
		<data expr="0.0" id="lp_floworifices_sensor_err" />
		<data expr="0.0" id="lp_floworifices_sensor_err_buff" />
		<data expr="0.0" id="lp_floworifices_sensor_err_samples" />
		<data expr="false" id="lp_floworifices_need_to_choose_orifice_size_before_prime_error" />
	</datamodel>
	<state id="main_region">
		<initial>
			<transition target="idle" type="internal">
			</transition>
		</initial>
		<state id="idle">
			<transition event ="vector"  type="internal" >
				 <assign location="lp_ao_pump_api_deprime" expr="lp_floworifices_id == 0"/>
				 <assign location="lp_floworifices_need_to_choose_orifice_size_before_prime_error" expr="lp_ao_main_pump_run &amp;&amp; lp_floworifices_id == 0"/>
			</transition>
			<transition event="Orifice_small"  target="choose_small_orifice">
			</transition>
			<transition event="Orifice_medium"  target="choose_medium_orifice">
			</transition>
			<transition event="Orifice_large"  target="choose_large_orifice">
			</transition>
			<transition  cond="lp_ao_pump_status_sensor_zeroing" target="measureing_sensor_error">
			</transition>
		</state>
		<state id="choose_small_orifice">
			<onentry>
				 <assign location="lp_floworifices_id" expr="1"/>
			</onentry>
			<transition   target="idle">
			</transition>
		</state>
		<state id="choose_medium_orifice">
			<onentry>
				 <assign location="lp_floworifices_id" expr="2"/>
			</onentry>
			<transition   target="idle">
			</transition>
		</state>
		<state id="choose_large_orifice">
			<onentry>
				 <assign location="lp_floworifices_id" expr="3"/>
			</onentry>
			<transition   target="idle">
			</transition>
		</state>
		<state id="measureing_sensor_error">
			<onentry>
				<send event="measureing_sensor_error_t_1_timeEvent_0" delay="10s"/>
			</onentry>
			<onexit>
				<cancel sendid="measureing_sensor_error_t_1_timeEvent_0" />
			</onexit>
			<onentry>
				 <assign location="lp_floworifices_sensor_err_buff" expr="sensorIn - sensorOut"/>
				 <assign location="lp_floworifices_sensor_err_samples" expr="1"/>
			</onentry>
			<transition event ="vector"  type="internal" >
				 <assign location="lp_floworifices_sensor_err_buff" expr="lp_floworifices_sensor_err_buff + sensorIn - sensorOut"/>
				 <assign location="lp_floworifices_sensor_err_samples" expr="lp_floworifices_sensor_err_samples + 1"/>
			</transition>
			<onexit>
				 <assign location="lp_floworifices_sensor_err" expr="lp_floworifices_sensor_err_buff / lp_floworifices_sensor_err_samples"/>
			</onexit>
			<transition  cond="!lp_ao_pump_status_sensor_zeroing" target="idle">
			</transition>
			<transition event="measureing_sensor_error_t_1_timeEvent_0"  target="idle">
			</transition>
		</state>
	</state>
</scxml>
`;
