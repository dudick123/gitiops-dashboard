import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { renderWithQuery } from "./test-utils";

describe("App", () => {
  it("renders the dashboard heading", () => {
    renderWithQuery(<App />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "GitOps Dashboard",
    );
  });
});
