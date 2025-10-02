export const DEFAULT_SCXML_TEMPLATE = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" version="1.0" datamodel="ecmascript" name="fa_argon">
	<datamodel>
		<data expr="0.0" id="ArgonLine_bar" />
		<data expr="0.0" id="ArgonLine_lmin" />
		<data expr="0.0" id="BatteryLeft_bar" />
		<data expr="0.0" id="BatteryRight_bar" />
		<data expr="0.0" id="BatteryLeftLineIn_bar" />
		<data expr="0.0" id="BatteryRightLineIn_bar" />
		<data expr="false" id="SustainedLowBatteryLeftPressure" />
		<data expr="false" id="SustainedLowBatteryRightPressure" />
		<data expr="false" id="SustainedLowArgonLinePressure" />
		<data expr="0" id="BatteryRight_onoff" />
		<data expr="0" id="BatteryLeft_onoff" />
		<data expr="false" id="BatteryPresent_onoff" />
		<data expr="0.0" id="AckButtonIn" />
		<data expr="false" id="AckButtonLight_onoff" />
		<data expr="false" id="AckButtonLight_blink" />
		<data expr="0" id="AckButtonLight_onTime" />
		<data expr="0" id="AckButtonLight_offTime" />
		<data expr="3.0" id="conf_minBatteryPressure" />
		<data expr="1.5" id="conf_minSupplyPressure" />
		<data expr="2.0" id="conf_testMinPressure" />
		<data expr="5" id="conf_testInitTime" />
		<data expr="5" id="conf_testFlowStabilizationTime" />
		<data expr="2.0" id="conf_testFlow" />
		<data expr="30" id="conf_testTime" />
		<data expr="600" id="conf_testFlowTimeout" />
		<data expr="600" id="conf_testTimeOut" />
		<data expr="0" id="fa_argon_ready" />
		<data expr="0.0" id="fa_argon_known_state" />
		<data expr="false" id="fa_argon_first_cycle" />
		<data expr="0.0" id="fa_argon_conf_minBatteryPressure" />
		<data expr="0.0" id="fa_argon_conf_minSupplyPressure" />
		<data expr="false" id="fa_argon_test_no_argon_flow_error" />
		<data expr="false" id="fa_argon_no_argon_alert" />
		<data expr="false" id="fa_argon_battery_left_empty_alert" />
		<data expr="false" id="fa_argon_battery_right_empty_alert" />
	</datamodel>
	<state id="main_region">
		<initial>
			<transition target="config_check" type="internal">
			</transition>
		</initial>
		<state id="config_check">
			<onentry>
				 <assign location="fa_argon_known_state" expr="1.0"/>
			</onentry>
			<transition  cond="conf_minBatteryPressure &lt; 0.0 || conf_minBatteryPressure &gt; 300.0 || conf_minSupplyPressure &lt; 0.0 || conf_minSupplyPressure &gt; 4.0" target="invalid_conf">
			</transition>
			<transition event="vector"  target="init">
			</transition>
		</state>
		<state id="invalid_conf">
			<onentry>
				 <assign location="fa_argon_known_state" expr="-1.0"/>
				 <assign location="fa_argon_ready" expr="-1"/>
			</onentry>
		</state>
		<state id="init">
			<onentry>
				<send event="init_t_0_timeEvent_0" delay="1s"/>
			</onentry>
			<onexit>
				<cancel sendid="init_t_0_timeEvent_0" />
			</onexit>
			<onentry>
				 <assign location="fa_argon_known_state" expr="2.0"/>
				 <assign location="fa_argon_ready" expr="1"/>
				 <assign location="fa_argon_first_cycle" expr="true"/>
				 <assign location="fa_argon_conf_minBatteryPressure" expr="conf_minBatteryPressure"/>
				 <assign location="fa_argon_conf_minSupplyPressure" expr="conf_minSupplyPressure"/>
				 <assign location="BatteryPresent_onoff" expr="true"/>
			</onentry>
			<transition event="init_t_0_timeEvent_0"  target="battery_test">
			</transition>
		</state>
		<state id="supply">
			<onentry>
				 <assign location="fa_argon_known_state" expr="3.0"/>
			</onentry>
			<initial>
				<transition target="choose" type="internal">
				</transition>
			</initial>
			<state id="choose">
				<onentry>
					 <assign location="fa_argon_known_state" expr="3.1"/>
				</onentry>
				<transition  cond="BatteryLeft_bar &gt; BatteryRight_bar &amp;&amp; BatteryRight_bar &gt; conf_minBatteryPressure" target="right">
				</transition>
				<transition  cond="BatteryLeft_bar &gt; conf_minBatteryPressure" target="left">
				</transition>
				<transition  cond="BatteryRight_bar &gt; conf_minBatteryPressure" target="right">
				</transition>
				<transition event="vector"  target="no_argon">
				</transition>
			</state>
			<state id="right">
				<onentry>
					 <assign location="fa_argon_known_state" expr="3.2"/>
				</onentry>
				<onentry>
					 <assign location="BatteryRight_onoff" expr="0"/>
					 <assign location="BatteryLeft_onoff" expr="1"/>
					 <assign location="BatteryPresent_onoff" expr="true"/>
				</onentry>
				<transition event ="vector"  type="internal" >
					 <assign location="BatteryRight_onoff" expr="0"/>
					 <assign location="BatteryLeft_onoff" expr="1"/>
					 <assign location="BatteryPresent_onoff" expr="true"/>
				</transition>
				<transition  cond="SustainedLowBatteryRightPressure &amp;&amp; SustainedLowArgonLinePressure" target="battery_right_empty">
				</transition>
				<transition event="change"  target="left">
				</transition>
			</state>
			<state id="left">
				<onentry>
					 <assign location="fa_argon_known_state" expr="3.3"/>
				</onentry>
				<onentry>
					 <assign location="BatteryRight_onoff" expr="1"/>
					 <assign location="BatteryLeft_onoff" expr="0"/>
					 <assign location="BatteryPresent_onoff" expr="true"/>
				</onentry>
				<transition event ="vector"  type="internal" >
					 <assign location="BatteryRight_onoff" expr="1"/>
					 <assign location="BatteryLeft_onoff" expr="0"/>
					 <assign location="BatteryPresent_onoff" expr="true"/>
				</transition>
				<transition  cond="SustainedLowBatteryLeftPressure &amp;&amp; SustainedLowArgonLinePressure" target="battery_left_empty">
				</transition>
				<transition event="change"  target="right">
				</transition>
			</state>
			<state id="no_argon">
				<onentry>
					 <assign location="fa_argon_known_state" expr="-3.0"/>
					 <assign location="fa_argon_no_argon_alert" expr="true"/>
					 <assign location="AckButtonLight_onoff" expr="true"/>
					 <assign location="AckButtonLight_blink" expr="true"/>
					 <assign location="AckButtonLight_onTime" expr="150"/>
					 <assign location="AckButtonLight_offTime" expr="150"/>
				</onentry>
				<onentry>
					 <assign location="BatteryRight_onoff" expr="0"/>
					 <assign location="BatteryLeft_onoff" expr="0"/>
					 <assign location="BatteryPresent_onoff" expr="false"/>
				</onentry>
				<transition event ="vector"  type="internal" >
					 <assign location="BatteryRight_onoff" expr="0"/>
					 <assign location="BatteryLeft_onoff" expr="0"/>
					 <assign location="BatteryPresent_onoff" expr="false"/>
				</transition>
				<onexit>
					 <assign location="AckButtonLight_blink" expr="false"/>
					 <assign location="AckButtonLight_onTime" expr="450"/>
					 <assign location="AckButtonLight_offTime" expr="450"/>
				</onexit>
				<transition  cond="BatteryLeft_bar &gt; conf_minBatteryPressure || BatteryRight_bar &gt; conf_minBatteryPressure" target="choose">
				</transition>
			</state>
			<state id="battery_right_empty">
				<onentry>
					 <assign location="fa_argon_known_state" expr="3.4"/>
					 <assign location="fa_argon_battery_right_empty_alert" expr="true"/>
					 <assign location="AckButtonLight_onoff" expr="true"/>
					 <assign location="AckButtonLight_blink" expr="false"/>
				</onentry>
				<transition event="vector"  target="choose">
				</transition>
			</state>
			<state id="battery_left_empty">
				<onentry>
					 <assign location="fa_argon_known_state" expr="3.5"/>
					 <assign location="fa_argon_battery_left_empty_alert" expr="true"/>
					 <assign location="AckButtonLight_onoff" expr="true"/>
					 <assign location="AckButtonLight_blink" expr="false"/>
				</onentry>
				<transition event="vector"  target="choose">
				</transition>
			</state>
			<transition event="ack"  target="battery_test">
			</transition>
			<transition  cond="AckButtonIn &gt; 0.5" target="battery_test">
			</transition>
		</state>
		<state id="battery_test">
			<onentry>
				 <assign location="fa_argon_known_state" expr="4.0"/>
				 <assign location="AckButtonLight_onoff" expr="true"/>
				 <assign location="AckButtonLight_blink" expr="true"/>
				 <assign location="AckButtonLight_onTime" expr="450"/>
				 <assign location="AckButtonLight_offTime" expr="450"/>
				 <assign location="fa_argon_test_no_argon_flow_error" expr="false"/>
			</onentry>
			<onexit>
				 <assign location="fa_argon_first_cycle" expr="false"/>
				 <assign location="AckButtonLight_blink" expr="false"/>
				 <assign location="AckButtonLight_onoff" expr="fa_argon_no_argon_alert || fa_argon_battery_left_empty_alert || fa_argon_battery_right_empty_alert"/>
			</onexit>
			<initial>
				<transition target="battery_test.choice_0" type="internal">
				</transition>
			</initial>
			<state id="battery_test.choice_0">
				<transition  cond="fa_argon_battery_right_empty_alert || fa_argon_no_argon_alert || fa_argon_first_cycle" target="test_right">
				</transition>
				<transition   target="battery_test.choice_1">
				</transition>
			</state>
			<state id="battery_test.choice_1">
				<transition  cond="fa_argon_battery_left_empty_alert || fa_argon_no_argon_alert || fa_argon_first_cycle" target="test_left">
				</transition>
				<transition   target="supply">
				</transition>
			</state>
			<state id="test_right">
				<onentry>
					 <assign location="fa_argon_known_state" expr="4.1"/>
				</onentry>
				<initial>
					<transition target="test_right_init" type="internal">
					</transition>
				</initial>
				<state id="testing_right">
					<onentry>
						<send event="testing_right_t_0_timeEvent_0" delayexpr="conf_testTimeOut * 1000"/>
					</onentry>
					<onexit>
						<cancel sendid="testing_right_t_0_timeEvent_0" />
					</onexit>
					<initial>
						<transition target="test_right_flowstabilization" type="internal">
						</transition>
					</initial>
					<state id="test_right_wait_for_flow">
						<onentry>
							<send event="test_right_wait_for_flow_t_0_timeEvent_0" delayexpr="conf_testFlowTimeout * 1000"/>
						</onentry>
						<onexit>
							<cancel sendid="test_right_wait_for_flow_t_0_timeEvent_0" />
						</onexit>
						<onentry>
							 <assign location="fa_argon_known_state" expr="4.12"/>
							 <assign location="BatteryRight_onoff" expr="0"/>
							 <assign location="BatteryLeft_onoff" expr="1"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</onentry>
						<transition event ="vector"  type="internal" >
							 <assign location="fa_argon_known_state" expr="4.12"/>
							 <assign location="BatteryRight_onoff" expr="0"/>
							 <assign location="BatteryLeft_onoff" expr="1"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</transition>
						<transition event="test_right_wait_for_flow_t_0_timeEvent_0"  target="test_right_flow_error">
						</transition>
						<transition  cond="ArgonLine_lmin &gt; conf_testFlow" target="test_right_checking_pressures">
						</transition>
					</state>
					<state id="test_right_checking_pressures">
						<onentry>
							<send event="test_right_checking_pressures_t_0_timeEvent_0" delayexpr="conf_testTime * 1000"/>
						</onentry>
						<onexit>
							<cancel sendid="test_right_checking_pressures_t_0_timeEvent_0" />
						</onexit>
						<onentry>
							 <assign location="fa_argon_known_state" expr="4.13"/>
							 <assign location="BatteryRight_onoff" expr="0"/>
							 <assign location="BatteryLeft_onoff" expr="1"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</onentry>
						<transition event ="vector"  type="internal" >
							 <assign location="fa_argon_known_state" expr="4.13"/>
							 <assign location="BatteryRight_onoff" expr="0"/>
							 <assign location="BatteryLeft_onoff" expr="1"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</transition>
						<transition event="test_right_checking_pressures_t_0_timeEvent_0"  target="test_right_succed">
						</transition>
						<transition  cond="ArgonLine_lmin &lt; conf_testFlow" target="test_right_wait_for_flow">
						</transition>
					</state>
					<state id="test_right_flowstabilization">
						<onentry>
							<send event="test_right_flowstabilization_t_0_timeEvent_0" delayexpr="conf_testFlowStabilizationTime * 1000"/>
						</onentry>
						<onexit>
							<cancel sendid="test_right_flowstabilization_t_0_timeEvent_0" />
						</onexit>
						<onentry>
							 <assign location="fa_argon_known_state" expr="4.11"/>
							 <assign location="BatteryRight_onoff" expr="0"/>
							 <assign location="BatteryLeft_onoff" expr="1"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</onentry>
						<transition event ="vector"  type="internal" >
							 <assign location="fa_argon_known_state" expr="4.11"/>
							 <assign location="BatteryRight_onoff" expr="0"/>
							 <assign location="BatteryLeft_onoff" expr="1"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</transition>
						<transition event="test_right_flowstabilization_t_0_timeEvent_0"  target="test_right_wait_for_flow">
						</transition>
					</state>
					<transition event="testing_right_t_0_timeEvent_0"  target="test_right_flow_error">
					</transition>
					<transition  cond="ArgonLine_bar &lt; conf_testMinPressure || BatteryRightLineIn_bar &lt; conf_testMinPressure || SustainedLowBatteryRightPressure" target="test_right_empty">
					</transition>
				</state>
				<state id="test_right_succed">
					<onentry>
						 <assign location="fa_argon_battery_right_empty_alert" expr="false"/>
						 <assign location="fa_argon_no_argon_alert" expr="false"/>
					</onentry>
					<transition   target="battery_test.choice_1">
					</transition>
				</state>
				<state id="test_right_empty">
					<onentry>
						 <assign location="fa_argon_battery_right_empty_alert" expr="true"/>
					</onentry>
					<transition   target="battery_test.choice_1">
					</transition>
				</state>
				<state id="test_right_flow_error">
					<onentry>
						<send event="test_right_flow_error_t_0_timeEvent_0" delay="1ms"/>
					</onentry>
					<onexit>
						<cancel sendid="test_right_flow_error_t_0_timeEvent_0" />
					</onexit>
					<onentry>
						 <assign location="fa_argon_test_no_argon_flow_error" expr="true"/>
						 <assign location="BatteryPresent_onoff" expr="true"/>
					</onentry>
					<onexit>
						 <assign location="fa_argon_test_no_argon_flow_error" expr="false"/>
					</onexit>
					<transition event="test_right_flow_error_t_0_timeEvent_0"  target="test_right_empty">
					</transition>
				</state>
				<state id="test_right_init">
					<onentry>
						<send event="test_right_init_t_0_timeEvent_0" delayexpr="conf_testInitTime * 1000"/>
					</onentry>
					<onexit>
						<cancel sendid="test_right_init_t_0_timeEvent_0" />
					</onexit>
					<onentry>
						 <assign location="fa_argon_known_state" expr="4.1"/>
						 <assign location="BatteryRight_onoff" expr="0"/>
						 <assign location="BatteryLeft_onoff" expr="0"/>
						 <assign location="BatteryPresent_onoff" expr="true"/>
					</onentry>
					<transition event ="vector"  type="internal" >
						 <assign location="fa_argon_known_state" expr="4.1"/>
						 <assign location="BatteryRight_onoff" expr="0"/>
						 <assign location="BatteryLeft_onoff" expr="0"/>
						 <assign location="BatteryPresent_onoff" expr="true"/>
					</transition>
					<transition event="test_right_init_t_0_timeEvent_0"  target="testing_right">
					</transition>
				</state>
			</state>
			<state id="test_left">
				<onentry>
					 <assign location="fa_argon_known_state" expr="4.2"/>
				</onentry>
				<initial>
					<transition target="test_left_init" type="internal">
					</transition>
				</initial>
				<state id="testing_left">
					<onentry>
						<send event="testing_left_t_0_timeEvent_0" delayexpr="conf_testTimeOut * 1000"/>
					</onentry>
					<onexit>
						<cancel sendid="testing_left_t_0_timeEvent_0" />
					</onexit>
					<initial>
						<transition target="test_left_flowstabilization" type="internal">
						</transition>
					</initial>
					<state id="test_left_wait_for_flow">
						<onentry>
							<send event="test_left_wait_for_flow_t_0_timeEvent_0" delayexpr="conf_testFlowTimeout * 1000"/>
						</onentry>
						<onexit>
							<cancel sendid="test_left_wait_for_flow_t_0_timeEvent_0" />
						</onexit>
						<onentry>
							 <assign location="fa_argon_known_state" expr="4.22"/>
							 <assign location="BatteryRight_onoff" expr="1"/>
							 <assign location="BatteryLeft_onoff" expr="0"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</onentry>
						<transition event ="vector"  type="internal" >
							 <assign location="fa_argon_known_state" expr="4.22"/>
							 <assign location="BatteryRight_onoff" expr="1"/>
							 <assign location="BatteryLeft_onoff" expr="0"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</transition>
						<transition event="test_left_wait_for_flow_t_0_timeEvent_0"  target="test_left_noflow_error">
						</transition>
						<transition  cond="ArgonLine_lmin &gt; conf_testFlow" target="test_left_checking_pressures">
						</transition>
					</state>
					<state id="test_left_checking_pressures">
						<onentry>
							<send event="test_left_checking_pressures_t_0_timeEvent_0" delayexpr="conf_testTime * 1000"/>
						</onentry>
						<onexit>
							<cancel sendid="test_left_checking_pressures_t_0_timeEvent_0" />
						</onexit>
						<onentry>
							 <assign location="fa_argon_known_state" expr="4.23"/>
							 <assign location="BatteryRight_onoff" expr="1"/>
							 <assign location="BatteryLeft_onoff" expr="0"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</onentry>
						<transition event ="vector"  type="internal" >
							 <assign location="fa_argon_known_state" expr="4.23"/>
							 <assign location="BatteryRight_onoff" expr="1"/>
							 <assign location="BatteryLeft_onoff" expr="0"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</transition>
						<transition event="test_left_checking_pressures_t_0_timeEvent_0"  target="test_left_succed">
						</transition>
						<transition  cond="ArgonLine_lmin &lt; conf_testFlow" target="test_left_wait_for_flow">
						</transition>
					</state>
					<state id="test_left_flowstabilization">
						<onentry>
							<send event="test_left_flowstabilization_t_0_timeEvent_0" delayexpr="conf_testFlowStabilizationTime * 1000"/>
						</onentry>
						<onexit>
							<cancel sendid="test_left_flowstabilization_t_0_timeEvent_0" />
						</onexit>
						<onentry>
							 <assign location="fa_argon_known_state" expr="4.21"/>
							 <assign location="BatteryRight_onoff" expr="1"/>
							 <assign location="BatteryLeft_onoff" expr="0"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</onentry>
						<transition event ="vector"  type="internal" >
							 <assign location="fa_argon_known_state" expr="4.21"/>
							 <assign location="BatteryRight_onoff" expr="1"/>
							 <assign location="BatteryLeft_onoff" expr="0"/>
							 <assign location="BatteryPresent_onoff" expr="true"/>
						</transition>
						<transition event="test_left_flowstabilization_t_0_timeEvent_0"  target="test_left_wait_for_flow">
						</transition>
					</state>
					<transition event="testing_left_t_0_timeEvent_0"  target="test_left_noflow_error">
					</transition>
					<transition  cond="ArgonLine_bar &lt; conf_testMinPressure || BatteryLeftLineIn_bar &lt; conf_testMinPressure || SustainedLowBatteryLeftPressure" target="test_left_empty">
					</transition>
				</state>
				<state id="test_left_succed">
					<onentry>
						 <assign location="fa_argon_battery_left_empty_alert" expr="false"/>
						 <assign location="fa_argon_no_argon_alert" expr="false"/>
					</onentry>
					<transition   target="supply">
					</transition>
				</state>
				<state id="test_left_empty">
					<onentry>
						 <assign location="fa_argon_battery_left_empty_alert" expr="true"/>
					</onentry>
					<transition   target="supply">
					</transition>
				</state>
				<state id="test_left_noflow_error">
					<onentry>
						<send event="test_left_noflow_error_t_0_timeEvent_0" delay="1ms"/>
					</onentry>
					<onexit>
						<cancel sendid="test_left_noflow_error_t_0_timeEvent_0" />
					</onexit>
					<onentry>
						 <assign location="fa_argon_test_no_argon_flow_error" expr="true"/>
						 <assign location="BatteryPresent_onoff" expr="true"/>
					</onentry>
					<onexit>
						 <assign location="fa_argon_test_no_argon_flow_error" expr="false"/>
					</onexit>
					<transition event="test_left_noflow_error_t_0_timeEvent_0"  target="test_left_empty">
					</transition>
				</state>
				<state id="test_left_init">
					<onentry>
						<send event="test_left_init_t_0_timeEvent_0" delayexpr="conf_testInitTime * 1000"/>
					</onentry>
					<onexit>
						<cancel sendid="test_left_init_t_0_timeEvent_0" />
					</onexit>
					<onentry>
						 <assign location="fa_argon_known_state" expr="4.2"/>
						 <assign location="BatteryRight_onoff" expr="0"/>
						 <assign location="BatteryLeft_onoff" expr="0"/>
						 <assign location="BatteryPresent_onoff" expr="true"/>
					</onentry>
					<transition event ="vector"  type="internal" >
						 <assign location="fa_argon_known_state" expr="4.2"/>
						 <assign location="BatteryRight_onoff" expr="0"/>
						 <assign location="BatteryLeft_onoff" expr="0"/>
						 <assign location="BatteryPresent_onoff" expr="true"/>
					</transition>
					<transition event="test_left_init_t_0_timeEvent_0"  target="testing_left">
					</transition>
				</state>
			</state>
		</state>
	</state>
</scxml>
`;
