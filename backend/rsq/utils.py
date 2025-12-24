# rsq/utils.py

def get_stage_status_and_color(stage):
    """
    Standard CGWB India Classification for Stage of Ground Water Extraction (%)
    """
    if stage is None or stage == "" or stage == "null":
        return "No Data", "#95a5a6"        # Gray

    try:
        stage = float(stage)
    except (TypeError, ValueError):
        return "No Data", "#95a5a6"

    if stage <= 70:
        return "Safe", "#27ae60"            # Green
    elif stage <= 90:
        return "Semi-Critical", "#f39c12"    # Orange
    elif stage <= 100:
        return "Critical", "#6006cd"         # Red
    else:
        return "Over-Exploited", "#c0392b"   # Dark Red
    


def round_props_to_2_decimals(props):
    rounded = {}
    for k, v in props.items():
        if isinstance(v, float):
            rounded[k] = round(v, 2)
        elif isinstance(v, int):
            rounded[k] = v  # keep ints as-is
        else:
            rounded[k] = v
    return rounded

