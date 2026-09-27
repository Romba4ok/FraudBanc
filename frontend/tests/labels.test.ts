import { describe, expect, it } from "vitest";
import {
  formatDataWarning,
  formatFeatureValue,
  getFeaturePresentation,
} from "../src/utils/labels";

describe("front-end labels", () => {
  it("translates known and monthly model features", () => {
    expect(getFeaturePresentation("EMPLOYMENTNATURE").label).toBe("Характер занятости");
    expect(getFeaturePresentation("MONTH_OVERDUE_C19").label).toBe(
      "Просрочки — месяц 19",
    );
    expect(getFeaturePresentation("MONTH_OVERDUE_A1").label).toBe(
      "Сумма просрочки — месяц 1",
    );
  });

  it("keeps an unknown technical name and formats values", () => {
    expect(getFeaturePresentation("NEW_SIGNAL").label).toBe("NEW_SIGNAL");
    expect(formatFeatureValue(null)).toBe("нет данных");
    expect(formatFeatureValue(12.3456)).toBe("12,346");
  });

  it("translates schema warnings without losing codes", () => {
    expect(formatDataWarning("Unknown categories in NEGATIVESTATUS: 116")).toBe(
      "Новые значения в поле «Негативный статус» (NEGATIVESTATUS): 116",
    );
    expect(
      formatDataWarning(
        "Extra columns will be preserved but ignored by the model: CNT_3D, NUM_CONTRACTS_OTHER",
      ),
    ).toContain("CNT_3D, NUM_CONTRACTS_OTHER");
  });
});
