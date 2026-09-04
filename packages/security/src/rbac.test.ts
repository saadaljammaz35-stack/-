import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { AdminRole, ForbiddenError } from '@nabd/shared';

import {
  FORBIDDEN_TO_ALL,
  Permission,
  allGrantedPermissions,
  assertPermission,
  assertPrivilegedLedgerAction,
  hasPermission,
  permissionsFor,
} from './rbac.js';

const ALL_ROLES = Object.values(AdminRole);

describe('The absolute rules — true for every role, including SUPER_ADMIN', () => {
  it("gives no role the ability to move a customer's money", () => {
    const granted = allGrantedPermissions();
    assert.ok(
      !granted.has('customer:transfer'),
      'no role may move customer money; value moves only on customer authority',
    );
  });

  it('gives no role the ability to alter or delete a ledger entry or audit log', () => {
    const granted = allGrantedPermissions();
    for (const forbidden of FORBIDDEN_TO_ALL) {
      assert.ok(!granted.has(forbidden), `${forbidden} must not be granted to any role`);
    }
  });

  it('separates duties: the role that assigns roles cannot post to the ledger', () => {
    // Otherwise SUPER_ADMIN could grant itself LEDGER_ADJUST and use it in the
    // same session — one compromised account, no second pair of eyes.
    assert.equal(hasPermission('SUPER_ADMIN', Permission.ROLE_ASSIGN), true);
    assert.equal(hasPermission('SUPER_ADMIN', Permission.LEDGER_ADJUST), false);
    assert.equal(hasPermission('SUPER_ADMIN', Permission.LEDGER_REVERSE), false);

    assert.equal(hasPermission('FINANCE', Permission.LEDGER_ADJUST), true);
    assert.equal(hasPermission('FINANCE', Permission.ROLE_ASSIGN), false);
    assert.equal(hasPermission('FINANCE', Permission.ADMIN_USER_MANAGE), false);
  });

  it('lets only FINANCE post an adjustment or a reversal', () => {
    for (const role of ALL_ROLES) {
      const expected = role === 'FINANCE';
      assert.equal(
        hasPermission(role, Permission.LEDGER_ADJUST),
        expected,
        `${role} adjust permission`,
      );
      assert.equal(
        hasPermission(role, Permission.LEDGER_REVERSE),
        expected,
        `${role} reverse permission`,
      );
    }
  });

  it('lets only COMPLIANCE open an identity document', () => {
    for (const role of ALL_ROLES) {
      assert.equal(
        hasPermission(role, Permission.KYC_DOCUMENT_VIEW),
        role === 'COMPLIANCE',
        `${role} must not open KYC documents`,
      );
    }
  });
});

describe('SUPPORT is deliberately powerless over money', () => {
  it('can read and respond, and nothing more', () => {
    // The most numerous, most social-engineered, least individually vetted
    // population with system access.
    assert.equal(hasPermission('SUPPORT', Permission.TICKET_RESPOND), true);
    assert.equal(hasPermission('SUPPORT', Permission.USER_READ), true);

    for (const denied of [
      Permission.LEDGER_ADJUST,
      Permission.LEDGER_REVERSE,
      Permission.ACCOUNT_FREEZE,
      Permission.USER_SUSPEND,
      Permission.KYC_DECIDE,
      Permission.KYC_DOCUMENT_VIEW,
      Permission.ADMIN_USER_MANAGE,
      Permission.ROLE_ASSIGN,
      Permission.SYSTEM_CONFIG,
    ]) {
      assert.equal(
        hasPermission('SUPPORT', denied),
        false,
        `SUPPORT must not have ${denied}`,
      );
    }
  });
});

describe('AUDITOR sees everything and changes nothing', () => {
  it('holds only read permissions', () => {
    for (const permission of permissionsFor('AUDITOR')) {
      assert.ok(
        permission.endsWith(':read') || permission === Permission.AUDIT_READ,
        `AUDITOR holds a non-read permission: ${permission}`,
      );
    }
  });

  it('can read the audit log', () => {
    assert.equal(hasPermission('AUDITOR', Permission.AUDIT_READ), true);
  });
});

describe('Every role', () => {
  it('can read a customer, so support is possible from any desk', () => {
    for (const role of ALL_ROLES) {
      assert.equal(hasPermission(role, Permission.USER_READ), true, `${role} user read`);
    }
  });

  it('holds no duplicate permissions', () => {
    for (const role of ALL_ROLES) {
      const permissions = permissionsFor(role);
      assert.equal(
        new Set(permissions).size,
        permissions.length,
        `${role} has a duplicated permission`,
      );
    }
  });

  it('holds at least one permission', () => {
    for (const role of ALL_ROLES) {
      assert.ok(permissionsFor(role).length > 0, `${role} has no permissions`);
    }
  });
});

describe('Enforcement', () => {
  it('throws ForbiddenError with the role and permission in details', () => {
    try {
      assertPermission('SUPPORT', Permission.LEDGER_ADJUST);
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof ForbiddenError);
      assert.equal(error.details['role'], 'SUPPORT');
      assert.equal(error.details['permission'], 'ledger:adjust');
    }
  });

  it('does not leak the reason to the caller', () => {
    const error = new ForbiddenError('x');
    assert.equal(error.publicMessage, 'You do not have permission to perform this action');
  });

  it('permits an allowed action', () => {
    assert.doesNotThrow(() => assertPermission('FINANCE', Permission.LEDGER_ADJUST));
  });
});

describe('Privileged ledger actions need more than a permission', () => {
  const valid = {
    role: 'FINANCE' as const,
    operatorId: 'admin_42',
    reason: 'Reversing a duplicated settlement reported by the partner bank',
    mfaSatisfied: true,
  };

  it('accepts a fully-formed request', () => {
    assert.doesNotThrow(() =>
      assertPrivilegedLedgerAction(valid, Permission.LEDGER_ADJUST),
    );
  });

  it('refuses without a satisfied second factor', () => {
    assert.throws(
      () =>
        assertPrivilegedLedgerAction(
          { ...valid, mfaSatisfied: false },
          Permission.LEDGER_ADJUST,
        ),
      ForbiddenError,
    );
  });

  it('refuses without a named operator', () => {
    // An unattributed adjustment cannot be audited, and the audit trail is the
    // real control here — not the permission check.
    assert.throws(
      () =>
        assertPrivilegedLedgerAction(
          { ...valid, operatorId: '   ' },
          Permission.LEDGER_ADJUST,
        ),
      ForbiddenError,
    );
  });

  it('refuses a reason too short to mean anything', () => {
    // "fix" tells a future auditor nothing at all.
    for (const reason of ['', 'fix', 'ok', 'adjust']) {
      assert.throws(
        () => assertPrivilegedLedgerAction({ ...valid, reason }, Permission.LEDGER_ADJUST),
        ForbiddenError,
        `reason "${reason}" should be rejected`,
      );
    }
  });

  it('refuses a role that lacks the permission even when everything else is right', () => {
    assert.throws(
      () =>
        assertPrivilegedLedgerAction(
          { ...valid, role: 'SUPER_ADMIN' },
          Permission.LEDGER_ADJUST,
        ),
      ForbiddenError,
    );
  });
});
