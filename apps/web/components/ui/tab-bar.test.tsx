// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "./tab-bar";

describe("TabBar", () => {
  afterEach(() => cleanup());

  it("renders icon-only tabs with accessible labels", () => {
    const onChange = vi.fn();

    render(
      <TabBar
        label="멤버 탐색"
        activeId="members"
        onChange={onChange}
        items={[
          { id: "members", label: "멤버", icon: <span>M</span> },
          { id: "chats", label: "대화", icon: <span>C</span> },
          { id: "more", label: "더보기", icon: <span>O</span> },
        ]}
      />,
    );

    const members = screen.getByRole("tab", { name: "멤버" });
    expect(members.textContent).toBe("M");
    expect(members.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "더보기" }));
    expect(onChange).toHaveBeenCalledWith("more");
  });
});
