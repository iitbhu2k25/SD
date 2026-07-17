# """
# varuna_chat_service.py — Orchestrates the Varuna Simulation chatbot: intent
# classification, what-if re-simulation, scenario comparison, report
# explanation, and general RAG Q&A (ported from the Streamlit chatbot.py).
# """
# from __future__ import annotations

# import logging
# import urllib.error

# from fastapi import HTTPException
# from sqlalchemy.orm import Session

# from app.api.schema.varuna_simulation_schema import ChatResponse, ChatSource
# from app.api.service.varuna_simulation import varuna_engine
# from app.api.service.varuna_simulation import varuna_scenario_store as store
# from app.api.service.varuna_simulation.varuna_llm_client import (
#     DOMAIN_KNOWLEDGE,
#     LM_STUDIO_URL,
#     ask_llm,
#     parse_query_intent_regex,
# )
# from app.api.service.varuna_simulation.varuna_rag_index import (
#     add_file_to_index,
#     load_or_build_index,
#     retrieve,
# )

# logger = logging.getLogger(__name__)

# DEFAULT_PARAMS = {
#     "population": 2_644_440,
#     "per_capita_sewage": 135.0,
#     "pct_untapped_drains": 31.0,
#     "pct_tapped_non_gravity": 32.0,
#     "pct_tapped_gravity": 0.0,
#     "pct_stp_gravity_sewer": 22.0,
#     "pct_stp_non_gravity_sewer": 15.0,
#     "pct_non_stp_sewer": 0.0,
#     "pct_in_situ": 0.0,
#     "stp_capacity": 260.0,
#     "pump_capacity": 140.0,
#     "maint_tapped": "low (0.40)",
#     "maint_stp": "high (>0.90)",
#     "maint_pump": "high (>0.90)",
#     "om_tapped": 4.0,
#     "om_stp": 28.47,
#     "om_pump": 1.4,
#     "stp_construction": 0.0,
#     "stp_om_cost": 0.0,
#     "tap_construction": 0.0,
#     "tap_om_cost": 0.0,
#     "pump_construction": 0.0,
#     "pump_om_cost": 0.0,
#     "strategies": [],
# }


# class VarunaChatService:
#     # ── Helpers ──────────────────────────────────────────────────────────────

#     def _get_scenario_by_name(self, db: Session, name: str):
#         return store.get_scenario_by_name(db, name)

#     def _known_scenario_names(self, db: Session) -> list[str]:
#         return [s.name for s in store.list_scenarios(db)]

#     def _load_baseline_state(self, db: Session, baseline_name: str) -> dict:
#         if baseline_name == "Default Baseline":
#             return dict(DEFAULT_PARAMS)
#         scenario = self._get_scenario_by_name(db, baseline_name)
#         if scenario is None:
#             return dict(DEFAULT_PARAMS)
#         state = dict(DEFAULT_PARAMS)
#         state.update(scenario.params or {})
#         return state

#     # ── Intent branch 1: what-if re-simulation ───────────────────────────────

#     def run_what_if_simulation(self, db: Session, baseline_name: str, changes: dict) -> str:
#         baseline_inputs = self._load_baseline_state(db, baseline_name)
#         state = dict(baseline_inputs)

#         for k, v in changes.items():
#             if k == "stp_capacity":
#                 state["stp_capacity"] = float(v)
#             elif k == "pumping_capacity":
#                 state["pump_capacity"] = float(v)
#             elif k == "maintenance_tapped":
#                 state["maint_tapped"] = float(v)
#             elif k == "maintenance_stp":
#                 state["maint_stp"] = float(v)
#             elif k == "maintenance_pumps":
#                 state["maint_pump"] = float(v)

#         df_baseline = varuna_engine.run_simulation(baseline_inputs, baseline_inputs.get("strategies", []))
#         df_new = varuna_engine.run_simulation(state, state.get("strategies", []))

#         row_base = df_baseline.iloc[-1]
#         row_new = df_new.iloc[-1]

#         base_treatment = float(row_base["Treatment %"])
#         new_treatment = float(row_new["Treatment %"])
#         base_untreated = float(row_base["Untreated Load (MLD)"])
#         new_untreated = float(row_new["Untreated Load (MLD)"])
#         base_bod = float(row_base["BOD of River"])
#         new_bod = float(row_new["BOD of River"])
#         base_overflow = (
#             float(row_base.get("Tapped Drain Overflow Total (MLD)", 0.0))
#             + float(row_base.get("STP Overflow (MLD)", 0.0))
#             + float(row_base.get("Pumping Station Overflow (MLD)", 0.0))
#         )
#         new_overflow = (
#             float(row_new.get("Tapped Drain Overflow Total (MLD)", 0.0))
#             + float(row_new.get("STP Overflow (MLD)", 0.0))
#             + float(row_new.get("Pumping Station Overflow (MLD)", 0.0))
#         )

#         bod_diff = new_bod - base_bod
#         if bod_diff < -0.05:
#             quality_status = f"makes the river quality **better** (BOD decreased from {base_bod:.2f} to {new_bod:.2f} mg/L, which is closer to cleaner conditions)."
#         elif bod_diff > 0.05:
#             quality_status = f"makes the river quality **worse** (BOD increased from {base_bod:.2f} to {new_bod:.2f} mg/L, representing higher pollution load)."
#         else:
#             quality_status = f"has **no significant effect** on the river quality (BOD remains at {new_bod:.2f} mg/L)."

#         recommendations = []
#         if new_bod > 10.0:
#             recommendations.append("The river BOD still exceeds the CPCB Class C standard of **10 mg/L**.")
#             if state.get("pct_untapped_drains", 0.0) > 0:
#                 recommendations.append(
#                     f"Consider **Conveyance Augmentation** (drain tapping) to direct untapped load "
#                     f"(currently {state['pct_untapped_drains']:.1f}% untapped) to the pipeline network."
#                 )
#             if new_treatment < 70.0:
#                 recommendations.append(
#                     f"The treatment level is only {new_treatment:.1f}% (target is >= 70%). "
#                     "Consider increasing STP installed capacity or improving maintenance levels."
#                 )
#             if float(row_new.get("STP Overflow (MLD)", 0.0)) > 1.0:
#                 recommendations.append(
#                     f"Significant STP overflow of {row_new['STP Overflow (MLD)']:.1f} MLD is occurring. "
#                     "Expand STP capacity or improve STP maintenance to recover design flow."
#                 )
#             if float(row_new.get("Pumping Station Overflow (MLD)", 0.0)) > 1.0:
#                 recommendations.append(
#                     f"Pumping capacity deficit causing {row_new['Pumping Station Overflow (MLD)']:.1f} MLD overflow. "
#                     "Increase pump station capacity."
#                 )
#         else:
#             recommendations.append(
#                 "Congratulations! The simulated BOD meets the CPCB Class C standard. "
#                 "Maintain active O&M costs to prevent infrastructure degradation."
#             )

#         updates = [f"- **{k.replace('_', ' ').upper()}**: changed from {baseline_inputs.get(k, 'N/A')} to {v}" for k, v in changes.items()]

#         return f"""
# ### What-If Simulation Summary

# * **Baseline Scenario**: {baseline_name}
# * **Applied Updates**:
# {chr(10).join(updates)}

# | Simulation Parameter (Final Day) | Baseline | Simulated New Value | Change |
# | :--- | :---: | :---: | :---: |
# | **Treatment Percentage (%)** | {base_treatment:.1f}% | {new_treatment:.1f}% | {new_treatment - base_treatment:+.1f}% |
# | **Untreated Sewage (MLD)** | {base_untreated:.1f} MLD | {new_untreated:.1f} MLD | {new_untreated - base_untreated:+.1f} MLD |
# | **River BOD (mg/L)** | {base_bod:.2f} mg/L | {new_bod:.2f} mg/L | {new_bod - base_bod:+.2f} mg/L |
# | **Total Pipeline & STP Overflows (MLD)** | {base_overflow:.1f} MLD | {new_overflow:.1f} MLD | {new_overflow - base_overflow:+.1f} MLD |

# **Assessment**: The modification {quality_status}

# #### Recommendations for Further Improvement:
# {chr(10).join('- ' + r for r in recommendations)}
# """

#     # ── Intent branch 2: scenario comparison ────────────────────────────────

#     def compare_scenarios(self, db: Session, sc1_name: str, sc2_name: str) -> str:
#         s1 = self._get_scenario_by_name(db, sc1_name)
#         s2 = self._get_scenario_by_name(db, sc2_name)

#         inputs1 = self._load_baseline_state(db, sc1_name)
#         inputs2 = self._load_baseline_state(db, sc2_name)

#         def last_row(scenario) -> dict:
#             if scenario is None or not scenario.rows:
#                 return {}
#             return scenario.rows[-1]

#         r1, r2 = last_row(s1), last_row(s2)

#         pop1, pop2 = inputs1.get("population", 2644440), inputs2.get("population", 2644440)
#         stp1, stp2 = inputs1.get("stp_capacity", 260.0), inputs2.get("stp_capacity", 260.0)
#         pump1, pump2 = inputs1.get("pump_capacity", 140.0), inputs2.get("pump_capacity", 140.0)
#         maint_t1, maint_t2 = inputs1.get("maint_tapped", "low (0.40)"), inputs2.get("maint_tapped", "low (0.40)")
#         maint_s1, maint_s2 = inputs1.get("maint_stp", "high (>0.90)"), inputs2.get("maint_stp", "high (>0.90)")

#         treat_pct1 = s1.treatment_pct if s1 else 0.0
#         treat_pct2 = s2.treatment_pct if s2 else 0.0
#         treated1, treated2 = r1.get("Treated (MLD)", 0.0), r2.get("Treated (MLD)", 0.0)
#         untreated1 = s1.untreated if s1 else 0.0
#         untreated2 = s2.untreated if s2 else 0.0
#         bod1, bod2 = r1.get("BOD of River", 0.0), r2.get("BOD of River", 0.0)
#         cap1, cap2 = r1.get("Capital Cost (Cr)", 0.0), r2.get("Capital Cost (Cr)", 0.0)
#         om1, om2 = r1.get("OM Cost (Cr)", 0.0), r2.get("OM Cost (Cr)", 0.0)

#         better = sc1_name if bod1 < bod2 else sc2_name
#         better_bod = min(bod1, bod2)
#         worse = sc2_name if bod1 < bod2 else sc1_name
#         worse_bod = max(bod1, bod2)

#         return f"""
# ### Scenario Comparison: **{sc1_name}** vs **{sc2_name}**

# | Parameter | {sc1_name} | {sc2_name} | Difference |
# | :--- | :---: | :---: | :---: |
# | **Population** | {pop1:,.0f} | {pop2:,.0f} | {pop2 - pop1:+,.0f} |
# | **STP Installed Capacity (MLD)** | {stp1:.1f} MLD | {stp2:.1f} MLD | {stp2 - stp1:+.1f} MLD |
# | **Pumping Capacity (MLD)** | {pump1:.1f} MLD | {pump2:.1f} MLD | {pump2 - pump1:+.1f} MLD |
# | **Tapped Network Maintenance** | {maint_t1} | {maint_t2} | - |
# | **STP Maintenance** | {maint_s1} | {maint_s2} | - |
# | **Treatment level (%)** | {treat_pct1:.1f}% | {treat_pct2:.1f}% | {treat_pct2 - treat_pct1:+.1f}% |
# | **Treated Sewage (MLD)** | {treated1:.1f} MLD | {treated2:.1f} MLD | {treated2 - treated1:+.1f} MLD |
# | **Untreated Sewage (MLD)** | {untreated1:.1f} MLD | {untreated2:.1f} MLD | {untreated2 - untreated1:+.1f} MLD |
# | **River BOD (mg/L)** | {bod1:.2f} mg/L | {bod2:.2f} mg/L | {bod2 - bod1:+.2f} mg/L |
# | **Capital Cost (Cr)** | Rs.{cap1:.2f} | Rs.{cap2:.2f} | Rs.{cap2 - cap1:+.2f} |
# | **O&M Cost (Cr)** | Rs.{om1:.2f} | Rs.{om2:.2f} | Rs.{om2 - om1:+.2f} |

# **Conclusion**: Scenario **{better}** results in a cleaner river with a BOD of **{better_bod:.2f} mg/L** compared to **{worse_bod:.2f} mg/L** in **{worse}**.
# """

#     # ── Intent branch 3: report explanation ─────────────────────────────────

#     def explain_report(self, db: Session, scenario_name: str) -> str:
#         scenario = self._get_scenario_by_name(db, scenario_name)
#         if scenario is None:
#             return f"Scenario report '{scenario_name}' was not found in saved scenarios. Please save it in the simulator first."

#         inputs = dict(DEFAULT_PARAMS)
#         inputs.update(scenario.params or {})
#         last = scenario.rows[-1] if scenario.rows else {}

#         pop = inputs.get("population", 2644440)
#         stp_cap = inputs.get("stp_capacity", 260.0)
#         pump_cap = inputs.get("pump_capacity", 140.0)
#         maint_tapped = inputs.get("maint_tapped", "low (0.40)")
#         maint_stp = inputs.get("maint_stp", "high (>0.90)")
#         maint_pump = inputs.get("maint_pump", "high (>0.90)")
#         om_tapped = inputs.get("om_tapped", 4.0)
#         om_stp = inputs.get("om_stp", 28.47)
#         om_pump = inputs.get("om_pump", 1.4)
#         const_stp = inputs.get("stp_construction", 0.0)
#         const_tap = inputs.get("tap_construction", 0.0)
#         const_pump = inputs.get("pump_construction", 0.0)

#         pct_untapped = inputs.get("pct_untapped_drains", 31.0)
#         pct_tapped_ng = inputs.get("pct_tapped_non_gravity", 32.0)
#         pct_tapped_g = inputs.get("pct_tapped_gravity", 0.0)
#         pct_stp_g = inputs.get("pct_stp_gravity_sewer", 22.0)
#         pct_stp_ng = inputs.get("pct_stp_non_gravity_sewer", 15.0)

#         treatment_pct = scenario.treatment_pct or 0.0
#         treated = last.get("Treated (MLD)", 0.0)
#         untreated = scenario.untreated or 0.0
#         bod = last.get("BOD of River", 0.0)
#         drain_overflow = last.get("Tapped Drain Overflow Total (MLD)", 0.0)
#         stp_overflow = last.get("STP Overflow (MLD)", 0.0)
#         cap_cost = last.get("Capital Cost (Cr)", 0.0)
#         om_cost = last.get("OM Cost (Cr)", 0.0)

#         bod_status = "Good (meets CPCB Class C standard of <= 10 mg/L)" if bod <= 10.0 else "Bad (exceeds CPCB Class C limit of 10 mg/L)"
#         treatment_status = "Good (meets target of >= 70%)" if treatment_pct >= 70.0 else "Bad (below target of 70%)"

#         def _maint_numeric(v) -> float:
#             if isinstance(v, (int, float)):
#                 return float(v)
#             s = str(v).lower()
#             return 0.4 if "low" in s else (0.6 if "medium" in s else 0.9)

#         causal_factors = []
#         if pct_untapped > 20:
#             causal_factors.append(
#                 f"A high percentage of untapped drains ({pct_untapped:.1f}%) results in sewage bypassing "
#                 "the collection network and flowing directly into the river."
#             )
#         if _maint_numeric(maint_tapped) < 0.6:
#             causal_factors.append(
#                 f"Low maintenance quality of the tapped network ({maint_tapped}) reduces screen condition, "
#                 f"causing {drain_overflow:.1f} MLD of tapped drain screen overflows."
#             )
#         if stp_cap < (treated + stp_overflow):
#             causal_factors.append(
#                 f"STP design capacity ({stp_cap:.1f} MLD) is insufficient to treat the collection network "
#                 f"inflow, leading to {stp_overflow:.1f} MLD of STP overflow bypassing treatment."
#             )
#         elif _maint_numeric(maint_stp) < 0.6 and stp_overflow > 0.0:
#             causal_factors.append(
#                 f"Degraded STP condition due to low maintenance ({maint_stp}) reduced the effective capacity "
#                 f"below design parameters, triggering {stp_overflow:.1f} MLD of overflows."
#             )

#         causal_explanation = " ".join(causal_factors) if causal_factors else (
#             "The infrastructure operated optimally, and remaining river pollution is driven by initial baseline gaps."
#         )

#         return f"""
# ### Scenario Summary Report: **{scenario.name}**

# #### Simulation Input Parameters:
# - **Total Population**: {pop:,.0f}
# - **STP Installed Capacity**: {stp_cap:.1f} MLD
# - **Pumping Capacity**: {pump_cap:.1f} MLD
# - **Maintenance Effort Factors**: Tapped: {maint_tapped}, STPs: {maint_stp}, Pumps: {maint_pump}
# - **O&M Costs**: Tapped Network: Rs.{om_tapped:.2f} Cr, STPs: Rs.{om_stp:.2f} Cr, Pumps: Rs.{om_pump:.2f} Cr
# - **Construction Unit Costs (Cr/MLD)**: STP: {const_stp:.2f}, Tapped Network: {const_tap:.2f}, Pumps: {const_pump:.2f}
# - **Sewage Discharge Distribution**:
#   - Untapped Drains: {pct_untapped:.1f}%
#   - Tapped Non-Gravity Drains: {pct_tapped_ng:.1f}%
#   - Tapped Gravity Drains: {pct_tapped_g:.1f}%
#   - STP Connected Gravity Sewer: {pct_stp_g:.1f}%
#   - STP Connected Non-Gravity Sewer: {pct_stp_ng:.1f}%

# #### Simulated Output Results (Final Year):
# - **Treatment Level (%)**: {treatment_pct:.1f}%
# - **Treated Flow**: {treated:.1f} MLD
# - **Untreated Flow**: {untreated:.1f} MLD
# - **BOD of River**: {bod:.2f} mg/L
# - **Drain Screen Overflow**: {drain_overflow:.1f} MLD
# - **STP Overflow**: {stp_overflow:.1f} MLD
# - **Capital Cost Incurred**: Rs.{cap_cost:.2f} Crores
# - **Cumulative O&M Cost**: Rs.{om_cost:.2f} Crores

# #### Interpretation & CPCB Comparison:
# - **River BOD Target (Class C <= 10 mg/L)**: The simulated BOD is **{bod:.2f} mg/L**, which is **{bod_status}**.
# - **Treatment Target (>= 70%)**: The simulated treatment percentage is **{treatment_pct:.1f}%**, which is **{treatment_status}**.

# #### Causal Link Analysis:
# {causal_explanation}
# """

#     # ── Uploads ──────────────────────────────────────────────────────────────

#     def upload_document(self, db: Session, filename: str, content: bytes) -> int:
#         try:
#             return add_file_to_index(db, filename, content)
#         except ValueError as e:
#             raise HTTPException(status_code=422, detail=str(e))

#     # ── Main entrypoint ──────────────────────────────────────────────────────

#     def ask(self, db: Session, question: str, baseline_name: str = "Default Baseline",
#             included_sources: dict[str, bool] | None = None) -> ChatResponse:
#         known_names = self._known_scenario_names(db)
#         intent = parse_query_intent_regex(question, known_scenario_names=known_names)

#         try:
#             if intent["type"] == "what_if":
#                 sim_output = self.run_what_if_simulation(db, baseline_name, intent["changes"])
#                 system_msg = f"""You are the Varuna River Rejuvenation assistant.
# The user requested a what-if analysis, and the system dynamics simulation engine has executed it.
# Here are the simulated metrics:
# {sim_output}

# Answer the user's question. Present the comparison table exactly as given, and explain how the parameter
# changes caused these modifications. Format cleanly."""
#                 reply = ask_llm([
#                     {"role": "system", "content": system_msg + DOMAIN_KNOWLEDGE},
#                     {"role": "user", "content": question},
#                 ])
#                 return ChatResponse(answer=reply, sources=[])

#             if intent["type"] == "compare":
#                 scenarios_to_compare = intent.get("scenarios", [])
#                 if len(scenarios_to_compare) < 2:
#                     return ChatResponse(answer="Please specify two scenarios to compare (e.g., 'Compare scenario test1 vs Default Baseline').")
#                 comp_output = self.compare_scenarios(db, scenarios_to_compare[0], scenarios_to_compare[1])
#                 system_msg = f"""You are the Varuna River Rejuvenation assistant.
# The user has requested a comparison between two scenarios. Here is the comparison data:
# {comp_output}

# Output the Markdown comparison table and discuss the differences, highlighting which scenario is
# better for river quality and why."""
#                 reply = ask_llm([
#                     {"role": "system", "content": system_msg + DOMAIN_KNOWLEDGE},
#                     {"role": "user", "content": question},
#                 ])
#                 return ChatResponse(answer=reply, sources=[])

#             if intent["type"] == "explain":
#                 explanation_output = self.explain_report(db, intent.get("scenario", ""))
#                 if "was not found" in explanation_output:
#                     return ChatResponse(answer=explanation_output)
#                 system_msg = f"""You are the Varuna River Rejuvenation assistant.
# The user has requested an explanation of a scenario report. Here is the report summary:
# {explanation_output}

# Outline the input parameters, output results, and CPCB comparisons, and explain the causal factors."""
#                 reply = ask_llm([
#                     {"role": "system", "content": system_msg + DOMAIN_KNOWLEDGE},
#                     {"role": "user", "content": question},
#                 ])
#                 return ChatResponse(answer=reply, sources=[])

#             # General RAG retrieval
#             index, chunks, embedder = load_or_build_index(db)
#             if not chunks:
#                 return ChatResponse(
#                     answer="The RAG index is currently empty. Upload documents or save a scenario first to index source materials.",
#                     sources=[],
#                 )

#             results = retrieve(question, index, chunks, embedder, top_k=3, included_sources=included_sources)
#             best_similarity = results[0]["similarity"] if results else 0.0
#             sources = [ChatSource(source=r["chunk"]["source"], snippet=r["chunk"]["text"][:200]) for r in results]

#             if best_similarity > 0.75:
#                 context_text = "\n\n---\n\n".join(f"[From {r['chunk']['source']}]\n{r['chunk']['text']}" for r in results)
#                 system_msg = f"""You are an expert AI assistant for the Varuna River Rejuvenation project.
# Answer the user's question STRICTLY from the project context below. Do not use any external knowledge.
# If the answer cannot be found in the context, say "I cannot find the answer in the retrieved project context."

# PROJECT CONTEXT:
# {context_text}
# """
#             elif best_similarity >= 0.5:
#                 context_text = "\n\n---\n\n".join(f"[From {r['chunk']['source']}]\n{r['chunk']['text']}" for r in results)
#                 system_msg = f"""You are an expert assistant for the Varuna River Rejuvenation project.
# Answer the user's question using the retrieved context below as hints, but supplement it with general
# river engineering, STP, BOD, and water quality knowledge.

# HINT CONTEXT:
# {context_text}
# """
#             else:
#                 sources = []
#                 system_msg = """You are an AI assistant specialized in river rejuvenation, Sewage Treatment
# Plants (STPs), water quality standards, BOD, and DO limits (CPCB Class C BOD limit = 10 mg/L).
# No specific project files matched the query, so answer using your general knowledge.
# Start your answer by clearly saying: "Answering from general knowledge:"."""

#             reply = ask_llm([
#                 {"role": "system", "content": system_msg + DOMAIN_KNOWLEDGE},
#                 {"role": "user", "content": question},
#             ])
#             return ChatResponse(answer=reply, sources=sources)

#         except urllib.error.URLError as err:
#             message = str(err)
#             if "timed out" in message.lower():
#                 raise HTTPException(
#                     status_code=504,
#                     detail="The LM Studio model is loading or timed out. Please load the model in LM Studio and try again.",
#                 )
#             raise HTTPException(
#                 status_code=503,
#                 detail=(
#                     "Connection to LM Studio refused. Please start the local inference server: "
#                     "open LM Studio, go to the Developer tab, load 'google_gemma-3-1b-it', click Start Server, "
#                     f"and ensure it runs on port 1234 ({LM_STUDIO_URL})."
#                 ),
#             )
#         except OSError as err:
#             raise HTTPException(status_code=503, detail=f"Connection to LM Studio failed: {err}")
