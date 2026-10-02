from app.services.canonical_materializer import _resolve_passthrough_sources


def test_resolves_namespaced_manifest_fields_to_wide_csv_columns() -> None:
    resolved = _resolve_passthrough_sources(
        (
            " GB_flag ",
            "was_canceled",
            "NUM_CONTRACT_BVU",
            "NUM_USAGES",
            "MONTH_OVERDUE_A39",
            "AGE",
        ),
        (
            "GB_flag",
            "client.attributes.was_canceled",
            "credit.history.num_contract_bvu",
            "client.attributes.num_usages",
            "credit.history.month_overdue_a39",
            "client.age_years",
        ),
    )

    assert resolved == {
        "GB_flag": " GB_flag ",
        "client.attributes.was_canceled": "was_canceled",
        "credit.history.num_contract_bvu": "NUM_CONTRACT_BVU",
        "client.attributes.num_usages": "NUM_USAGES",
        "credit.history.month_overdue_a39": "MONTH_OVERDUE_A39",
        "client.age_years": "AGE",
    }
