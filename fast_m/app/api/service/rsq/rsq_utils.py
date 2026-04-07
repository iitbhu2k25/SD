def get_stage_status_and_color(stage) -> tuple[str, str]:
    """
    CGWB India Classification for Stage of Ground Water Extraction (%)
    """
    if stage is None or stage == "" or stage == "null":
        return "No Data", "#95a5a6"

    try:
        stage = float(stage)
    except (TypeError, ValueError):
        return "No Data", "#95a5a6"

    if stage <= 70:
        return "Safe", "#27ae60"
    elif stage <= 90:
        return "Semi-Critical", "#f39c12"
    elif stage <= 100:
        return "Critical", "#6006cd"
    else:
        return "Over-Exploited", "#c0392b"


def round_props_to_2_decimals(props: dict) -> dict:
    rounded = {}
    for k, v in props.items():
        if isinstance(v, float):
            rounded[k] = round(v, 2)
        else:
            rounded[k] = v
    return rounded
