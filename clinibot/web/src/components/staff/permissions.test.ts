import { describe, expect, it } from "vitest";
import {
  canChangeRoles,
  canInvite,
  countOwners,
  invitableRoles,
  removalPermission,
  roleCan,
  roleChangePermission,
  type TeamMember,
} from "./permissions";

const owner: TeamMember = { member_id: "m-owner", user_id: "u-owner", role: "owner" };
const owner2: TeamMember = { member_id: "m-owner2", user_id: "u-owner2", role: "owner" };
const admin: TeamMember = { member_id: "m-admin", user_id: "u-admin", role: "admin" };
const admin2: TeamMember = { member_id: "m-admin2", user_id: "u-admin2", role: "admin" };
const reception: TeamMember = { member_id: "m-rec", user_id: "u-rec", role: "receptionist" };
const reception2: TeamMember = { member_id: "m-rec2", user_id: "u-rec2", role: "receptionist" };

const as = (member: TeamMember) => ({ role: member.role, userId: member.user_id });

describe("invitations", () => {
  it("limits the roles to what the caller may grant", () => {
    expect(invitableRoles("owner")).toEqual(["admin", "receptionist"]);
    expect(invitableRoles("admin")).toEqual(["receptionist"]);
    expect(invitableRoles("receptionist")).toEqual([]);
    expect(invitableRoles(null)).toEqual([]);
  });

  it("never offers owner as an invitation role", () => {
    expect(invitableRoles("owner")).not.toContain("owner");
  });

  it("lets owners and admins invite", () => {
    expect(canInvite("owner")).toBe(true);
    expect(canInvite("admin")).toBe(true);
    expect(canInvite("receptionist")).toBe(false);
  });
});

describe("role changes", () => {
  it("are for owners only", () => {
    expect(canChangeRoles("owner")).toBe(true);
    expect(canChangeRoles("admin")).toBe(false);
    expect(roleChangePermission(as(admin), reception, 1)).toEqual({
      allowed: false,
      reason: "owner_only",
    });
  });

  it("offer every other role", () => {
    expect(roleChangePermission(as(owner), reception, 1)).toEqual({
      allowed: true,
      self: false,
      options: ["owner", "admin"],
    });
  });

  it("never demote the last owner", () => {
    expect(roleChangePermission(as(owner), owner, 1)).toEqual({
      allowed: false,
      reason: "last_owner",
    });
  });

  it("mark a change of your own role", () => {
    expect(roleChangePermission(as(owner), owner, 2)).toEqual({
      allowed: true,
      self: true,
      options: ["admin", "receptionist"],
    });
  });
});

describe("removing members", () => {
  it("owners remove anyone except the last owner", () => {
    expect(removalPermission(as(owner), admin, 1)).toEqual({ allowed: true, kind: "remove" });
    expect(removalPermission(as(owner), reception, 1)).toEqual({ allowed: true, kind: "remove" });
    expect(removalPermission(as(owner), owner2, 2)).toEqual({ allowed: true, kind: "remove" });
    expect(removalPermission(as(owner), owner2, 1)).toEqual({
      allowed: false,
      reason: "last_owner",
    });
  });

  it("admins remove receptionists only", () => {
    expect(removalPermission(as(admin), reception, 1)).toEqual({ allowed: true, kind: "remove" });
    expect(removalPermission(as(admin), admin2, 1)).toEqual({
      allowed: false,
      reason: "owner_only",
    });
    expect(removalPermission(as(admin), owner, 1)).toEqual({
      allowed: false,
      reason: "owner_only",
    });
  });

  it("receptionists remove nobody else", () => {
    expect(removalPermission(as(reception), reception2, 1)).toEqual({
      allowed: false,
      reason: "no_permission",
    });
  });

  it("anyone may leave, except the last owner", () => {
    expect(removalPermission(as(reception), reception, 1)).toEqual({
      allowed: true,
      kind: "leave",
    });
    expect(removalPermission(as(admin), admin, 1)).toEqual({ allowed: true, kind: "leave" });
    expect(removalPermission(as(owner), owner, 2)).toEqual({ allowed: true, kind: "leave" });
    expect(removalPermission(as(owner), owner, 1)).toEqual({
      allowed: false,
      reason: "last_owner",
    });
  });
});

describe("capability table", () => {
  it("matches the server rules", () => {
    expect(roleCan("receptionist", "conversations")).toBe(true);
    expect(roleCan("receptionist", "knowledgeView")).toBe(true);
    expect(roleCan("receptionist", "knowledgeEdit")).toBe(false);
    expect(roleCan("receptionist", "audit")).toBe(false);
    expect(roleCan("admin", "staffReceptionists")).toBe(true);
    expect(roleCan("admin", "staffRoles")).toBe(false);
    expect(roleCan("admin", "deleteClinic")).toBe(false);
    expect(roleCan("owner", "deleteClinic")).toBe(true);
  });

  it("counts owners", () => {
    expect(countOwners([owner, owner2, admin, reception])).toBe(2);
    expect(countOwners([])).toBe(0);
  });
});
