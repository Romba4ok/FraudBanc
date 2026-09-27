import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewAnalysisPage } from "../src/routes/NewAnalysisPage";

const baseProps = {
  error: null,
  hasActiveAnalysis: false,
  processing: false,
  status: null,
  onClearError: vi.fn(),
  onStart: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("new analysis page", () => {
  it("rejects unsupported, empty and oversized files before API upload", () => {
    render(<NewAnalysisPage {...baseProps} />);
    const input = screen.getByLabelText("Выберите CSV файл");

    fireEvent.change(input, {
      target: { files: [new File(["x"], "clients.xlsx")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("расширением .csv");

    fireEvent.change(input, {
      target: { files: [new File([], "empty.csv")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Файл пуст");

    const oversized = new File(["x"], "large.csv", { type: "text/csv" });
    Object.defineProperty(oversized, "size", { value: 151 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole("alert")).toHaveTextContent("150 МБ");
    expect(screen.getByRole("button", { name: "Запустить анализ" })).toBeDisabled();
  });

  it("requires confirmation before replacing an active analysis", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <NewAnalysisPage
        {...baseProps}
        hasActiveAnalysis
        onStart={onStart}
      />,
    );
    const file = new File(["signal;GB_flag\n9;1"], "clients.csv", {
      type: "text/csv",
    });
    await user.upload(screen.getByLabelText("Выберите CSV файл"), file);
    await user.click(screen.getByRole("button", { name: "Запустить анализ" }));
    expect(screen.getByRole("dialog", { name: "Заменить текущий анализ?" })).toBeInTheDocument();
    expect(onStart).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Запустить анализ" }));
    await user.click(screen.getByRole("button", { name: "Удалить и продолжить" }));
    expect(onStart).toHaveBeenCalledWith(file);
  });
});
