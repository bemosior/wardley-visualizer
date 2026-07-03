import { describe, expect, it } from "vitest";
import { createMascotAvatar } from "./mascotAvatar";

describe("createMascotAvatar", () => {
  it("renders a body, two eyes, and a mouth", () => {
    const avatar = createMascotAvatar();

    expect(avatar.element.querySelector(".wd-mascot-avatar-body")).not.toBeNull();
    expect(avatar.element.querySelectorAll(".wd-mascot-avatar-eye").length).toBe(2);
    expect(avatar.element.querySelector(".wd-mascot-avatar-mouth")).not.toBeNull();
  });

  it("starts in the idle state", () => {
    const avatar = createMascotAvatar();
    expect(avatar.element.classList.contains("wd-mascot--idle")).toBe(true);
  });
});

describe("MascotAvatar.setState", () => {
  it("swaps to the new state class", () => {
    const avatar = createMascotAvatar();
    avatar.setState("talking");

    expect(avatar.element.classList.contains("wd-mascot--talking")).toBe(true);
  });

  it("is mutually exclusive — only one state class present at a time", () => {
    const avatar = createMascotAvatar();
    avatar.setState("talking");
    avatar.setState("idle");

    expect(avatar.element.classList.contains("wd-mascot--talking")).toBe(false);
    expect(avatar.element.classList.contains("wd-mascot--idle")).toBe(true);
  });

  it("celebrating replaces idle", () => {
    const avatar = createMascotAvatar();
    avatar.setState("celebrating");

    expect(avatar.element.classList.contains("wd-mascot--idle")).toBe(false);
    expect(avatar.element.classList.contains("wd-mascot--celebrating")).toBe(true);
  });
});
