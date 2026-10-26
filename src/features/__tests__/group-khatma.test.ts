import { groupLink, parseGroupCode } from '../group-khatma';

describe('group khatma codes', () => {
  it('accepts a code or an invite link, in any case', () => {
    expect(parseGroupCode('5fbn42h5')).toBe('5FBN42H5');
    expect(parseGroupCode(' 5FBN-42H5 ')).toBe('5FBN42H5');
    expect(parseGroupCode('اختر جزءك https://ma-allah.vercel.app/group/5FBN42H5 من هنا')).toBe('5FBN42H5');
    expect(parseGroupCode(groupLink('ABCD2345'))).toBe('ABCD2345');
  });

  it('rejects anything that is not a valid code', () => {
    expect(parseGroupCode('')).toBeNull();
    expect(parseGroupCode('ABC')).toBeNull();
    // I, L, O, 0 and 1 are never used, to avoid misreading.
    expect(parseGroupCode('ABCDEFGI')).toBeNull();
    expect(parseGroupCode('ABCD0123')).toBeNull();
  });
});
