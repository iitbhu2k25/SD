# """
# varuna_llm_client.py — Thin client for the local LM Studio OpenAI-compatible
# server, plus the LLM-based query-intent classifier (ported from chatbot.py).
# """
# from __future__ import annotations

# import json
# import os
# import re
# import time
# import urllib.error
# import urllib.request

# MODEL = "gemma-3-1b-it"
# LM_STUDIO_HOST = os.environ.get("LM_STUDIO_HOST", "localhost:1234")
# LM_STUDIO_URL = f"http://{LM_STUDIO_HOST}/v1/chat/completions"

# DOMAIN_KNOWLEDGE = """
# DOMAIN KNOWLEDGE & TERMINOLOGY:
# - STP = Sewage Treatment Plant (treatment target >= 70%)
# - BOD = Biological Oxygen Demand (lower = cleaner river, CPCB Class C limit = 10 mg/L)
# - DO = Dissolved Oxygen (higher = better for aquatic life)
# - MLD = Million Litres per Day
# - Drain tapping = connecting open drains to STP pipeline network
# - O&M = Operation and Maintenance
# - Untreated load = sewage reaching river without treatment
# - Namami Gange = national river cleaning mission
# - CPCB = Central Pollution Control Board
# - Treatment % = (Treated MLD / Total Sewage MLD) x 100
# """


# def ask_llm(messages: list[dict], timeout: int = 120, retries: int = 2) -> str:
#     payload = json.dumps({
#         "model": MODEL,
#         "messages": messages,
#         "temperature": 0.3,
#         "max_tokens": 800,
#     }).encode("utf-8")

#     last_error = None
#     for attempt in range(retries):
#         try:
#             req = urllib.request.Request(
#                 LM_STUDIO_URL, data=payload, headers={"Content-Type": "application/json"}
#             )
#             with urllib.request.urlopen(req, timeout=timeout) as response:
#                 result = json.loads(response.read())
#                 return result["choices"][0]["message"]["content"]
#         except (urllib.error.URLError, TimeoutError, OSError) as e:
#             last_error = e
#             if attempt < retries - 1:
#                 time.sleep(2)
#     raise last_error


# def parse_query_intent(query: str) -> dict:
#     system_prompt = """You are a precise JSON parser for a River Rejuvenation simulation chatbot.
# Analyze the user query and output a JSON object indicating if the query is a parameter modification (what_if), a comparison of scenarios (compare), a report explanation request (explain), or a general question (general).

# Parameters that can be modified (only output numeric updates if user specifies a change):
# - "stp_capacity" (float, in MLD)
# - "pumping_capacity" (float, in MLD)
# - "maintenance_tapped" (float: 0.4 for low, 0.7 for medium, 0.9 for high)
# - "maintenance_stp" (float: 0.4 for low, 0.7 for medium, 0.9 for high)
# - "maintenance_pumps" (float: 0.4 for low, 0.7 for medium, 0.9 for high)

# Respond ONLY with a valid JSON block, using these exact structures:

# For a what-if query (parameter modification):
# {"type": "what_if", "changes": {"stp_capacity": 100.0, "pumping_capacity": 150.0}}

# For a compare query (comparing two scenarios):
# {"type": "compare", "scenarios": ["scenario1", "scenario2"]}

# For a report explanation query (user asks to describe/explain a specific scenario or report):
# {"type": "explain", "scenario": "scenario_name"}

# For general RAG/scientific questions:
# {"type": "general"}
# """
#     try:
#         payload = json.dumps({
#             "model": MODEL,
#             "messages": [
#                 {"role": "system", "content": system_prompt},
#                 {"role": "user", "content": query},
#             ],
#             "temperature": 0.0,
#             "max_tokens": 128,
#         }).encode("utf-8")
#         req = urllib.request.Request(
#             LM_STUDIO_URL, data=payload, headers={"Content-Type": "application/json"}
#         )
#         with urllib.request.urlopen(req, timeout=30) as response:
#             result = json.loads(response.read())
#             raw_content = result["choices"][0]["message"]["content"].strip()
#             if raw_content.startswith("```"):
#                 lines = raw_content.split("\n")
#                 if lines[0].startswith("```json") or lines[0].startswith("```"):
#                     raw_content = "\n".join(lines[1:-1])
#             return json.loads(raw_content)
#     except Exception:
#         return parse_query_intent_regex(query)


# def parse_query_intent_regex(query: str, known_scenario_names: list[str] | None = None) -> dict:
#     query_lower = query.lower()
#     known_scenario_names = known_scenario_names or []

#     explain_match = re.search(
#         r'(?:explain|tell me about|describe|summary of)\s+(?:scenario|report)?\s*([a-zA-Z0-9_\-]+)',
#         query_lower,
#     )
#     if explain_match:
#         sc_candidate = explain_match.group(1)
#         if sc_candidate not in ["what", "how", "why", "the", "a", "my"]:
#             for sname in known_scenario_names:
#                 if sname.lower() == sc_candidate.lower() or sname.replace("_", " ").lower() == sc_candidate.replace("_", " ").lower():
#                     return {"type": "explain", "scenario": sname}

#     if "compare" in query_lower:
#         matched_scenarios = [s for s in known_scenario_names if s.lower() in query_lower or s.replace("_", " ").lower() in query_lower]
#         if "baseline" in query_lower or "default" in query_lower:
#             matched_scenarios.append("Default Baseline")
#         if len(matched_scenarios) >= 1:
#             if len(matched_scenarios) == 1 and "Default Baseline" not in matched_scenarios:
#                 matched_scenarios.append("Default Baseline")
#             return {"type": "compare", "scenarios": matched_scenarios[:2]}

#     changes = {}
#     stp_match = re.search(
#         r'(?:stp|treatment)(?:\s+capacity)?\s+(?:(?:to|is|of|=|becomes|increased\s+to|decreased\s+to|set\s+to|changed\s+to)\s+)?(\d+(?:\.\d+)?)\s*(?:mld)?',
#         query_lower,
#     )
#     if stp_match:
#         changes["stp_capacity"] = float(stp_match.group(1))

#     pump_match = re.search(
#         r'(?:pump|pumping)(?:\s+capacity)?\s+(?:(?:to|is|of|=|becomes|increased\s+to|decreased\s+to|set\s+to|changed\s+to)\s+)?(\d+(?:\.\d+)?)\s*(?:mld)?',
#         query_lower,
#     )
#     if pump_match:
#         changes["pumping_capacity"] = float(pump_match.group(1))

#     def _maint_value(val: str) -> float:
#         return 0.4 if val == "low" else (0.7 if val == "medium" else 0.9)

#     if "stp maintenance" in query_lower:
#         m = re.search(r'stp maintenance\s+(?:drops\s+to|changes\s+to|becomes|to|is)\s*(low|medium|high|0\.\d+)', query_lower)
#         if m:
#             changes["maintenance_stp"] = _maint_value(m.group(1))
#     if "tapped maintenance" in query_lower or "drain maintenance" in query_lower:
#         m = re.search(r'(?:tapped|drain) maintenance\s+(?:drops\s+to|changes\s+to|becomes|to|is)\s*(low|medium|high|0\.\d+)', query_lower)
#         if m:
#             changes["maintenance_tapped"] = _maint_value(m.group(1))
#     if "pump maintenance" in query_lower:
#         m = re.search(r'pump maintenance\s+(?:drops\s+to|changes\s+to|becomes|to|is)\s*(low|medium|high|0\.\d+)', query_lower)
#         if m:
#             changes["maintenance_pumps"] = _maint_value(m.group(1))

#     if not any(k in changes for k in ["maintenance_stp", "maintenance_tapped", "maintenance_pumps"]):
#         m = re.search(r'maintenance\s+(?:drops\s+to|changes\s+to|becomes|to|is)\s*(low|medium|high|0\.\d+)', query_lower)
#         if m:
#             mapped_val = _maint_value(m.group(1))
#             changes["maintenance_tapped"] = mapped_val
#             changes["maintenance_stp"] = mapped_val
#             changes["maintenance_pumps"] = mapped_val

#     if changes:
#         return {"type": "what_if", "changes": changes}

#     return {"type": "general"}
