// «حفظ الصغار»: one profile per child, each with their own stars; everything stays on this device.
import { router } from 'expo-router';
import { Baby, Crown, LockKeyhole, LockKeyholeOpen, Star, Trash2, UserRoundPlus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { confirmAsync } from '@/components/dialogs';
import { Screen } from '@/components/screen';
import { Button, Card, EmptyState, ForwardChevron, IconButton, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { KidAvatar } from '@/features/kids-ui';
import { useI18n } from '@/i18n';
import { KID_COLORS, kidStats } from '@/lib/kids';
import { useKidsStore } from '@/store/user';
import { useTheme } from '@/theme';

export default function Kids() {
  const t = useTheme();
  const { tr } = useI18n();
  const kids = useKidsStore((s) => s.kids);
  const add = useKidsStore((s) => s.add);
  const remove = useKidsStore((s) => s.remove);
  const locked = useKidsStore((s) => s.lockPin != null);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(KID_COLORS[kids.length % KID_COLORS.length]);

  const create = () => {
    if (!name.trim()) return;
    const id = add(name, color);
    setName('');
    setColor(KID_COLORS[(kids.length + 1) % KID_COLORS.length]);
    router.push({ pathname: '/kids/[id]', params: { id } });
  };

  return (
    <Screen
      title={tr('حفظ الصغار', 'Kids’ hifz')}
      subtitle={tr('قصار السور، آية آية، بنجمة لكل آية', 'The short surahs, verse by verse, a star for each')}
      actions={locked ? [{ icon: LockKeyholeOpen, label: tr('الخروج من وضع الطفل', 'Leave child mode'), onPress: () => router.push('/kids/lock') }] : []}>
      {kids.length ? (
        kids.map((k) => {
          const s = kidStats(k);
          return (
            <Card key={k.id} onPress={() => router.push({ pathname: '/kids/[id]', params: { id: k.id } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <KidAvatar name={k.name} color={k.color} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt weight="bold">{k.name}</Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Star size={16} color="#E9B308" fill="#E9B308" />
                      <Txt variant="caption">{s.stars}</Txt>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Crown size={16} color="#C98A0B" />
                      <Txt variant="caption">{tr(`${s.crowns} سورة`, `${s.crowns} surahs`)}</Txt>
                    </View>
                  </View>
                </View>
                {locked ? null : (
                <IconButton
                  icon={Trash2}
                  label={tr('حذف', 'Delete')}
                  tone="plain"
                  size={38}
                  onPress={async () => {
                    if (await confirmAsync(tr(`حذف ملف ${k.name}؟`, `Delete ${k.name}’s profile?`), tr('تُحذف نجومه وتقدّمه من هذا الجهاز.', 'Their stars and progress are removed from this device.'), tr('حذف', 'Delete'), tr('إلغاء', 'Cancel'))) remove(k.id);
                  }}
                />
                )}
                <ForwardChevron />
              </View>
            </Card>
          );
        })
      ) : (
        <EmptyState icon={Baby} title={tr('أضف طفلك الأول', 'Add your first child')} message={tr('لكل طفل ملف ونجوم خاصة به، ويمكن أن يحفظ عدة أطفال على جهاز واحد.', 'Each child gets their own profile and stars; several children can share one device.')} />
      )}

      {locked ? null : (
      <Card style={{ gap: 12 }}>
        <Txt weight="semibold">{tr('طفل جديد', 'New child')}</Txt>
        <TextInput value={name} onChangeText={setName} maxLength={30} placeholder={tr('اسمه', 'Their name')} placeholderTextColor={t.colors.textFaint} style={inputStyle(t)} onSubmitEditing={create} />
        <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
          {KID_COLORS.map((c) => (
            <Pressable key={c} accessibilityRole="button" accessibilityLabel={c} accessibilityState={{ selected: c === color }} onPress={() => setColor(c)} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: c, borderWidth: c === color ? 3 : 0, borderColor: t.colors.text }} />
          ))}
        </View>
        <Button title={tr('أضف', 'Add')} icon={UserRoundPlus} onPress={create} disabled={!name.trim()} />
      </Card>
      )}
      {locked || !kids.length ? null : (
        <Card tone="soft" onPress={() => router.push('/kids/lock')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <LockKeyhole size={22} color={t.colors.primaryDeep} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt weight="semibold">{tr('وضع الطفل', 'Child mode')}</Txt>
            <Txt variant="caption" muted>
              {tr('أعطِ الجوال لطفلك وهو مقفل على هذا القسم برقم سري', 'Hand over the phone locked to this area with a PIN')}
            </Txt>
          </View>
          <ForwardChevron />
        </Card>
      )}
      <Txt variant="caption" muted center style={{ lineHeight: 20 }}>
        {tr('يستمع الطفل للآية بصوت القارئ ثم يرددها، فينال نجمة. وحين تسمعه يقرأ السورة كاملة من حفظه امنحه تاجها.', 'The child listens to the verse, then says it back for a star. When you hear the whole surah from memory, give it its crown.')}
      </Txt>
    </Screen>
  );
}
