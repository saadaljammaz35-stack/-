// «وقفت هنا»: on a phone the family shares, each person keeps their own place in the mushaf.
import { Check, Trash2, UserRoundPlus, X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton, Txt } from '@/components/ui';
import { inputStyle } from '@/features/group-ui';
import { useI18n } from '@/i18n';
import { useQuranStore } from '@/store/user';
import { useTheme } from '@/theme';

export function ReadersSheet({ page, onGo, onClose }: { page: number; onGo: (page: number) => void; onClose: () => void }) {
  const t = useTheme();
  const { tr } = useI18n();
  const insets = useSafeAreaInsets();
  const readers = useQuranStore((s) => s.readers);
  const placeReader = useQuranStore((s) => s.placeReader);
  const removeReader = useQuranStore((s) => s.removeReader);
  const [name, setName] = useState('');

  const add = () => {
    if (!name.trim()) return;
    placeReader(name, page);
    setName('');
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: t.colors.overlay }} onPress={onClose} />
      <View style={{ backgroundColor: t.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: insets.bottom + 12, paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Txt weight="semibold">{tr('وقفت هنا', 'I stopped here')}</Txt>
            <Txt variant="caption" muted>
              {tr(`لكل من يقرأ على هذا الجوال موضعه. الصفحة الحالية ${page}.`, `A place for each person reading on this phone. This is page ${page}.`)}
            </Txt>
          </View>
          <IconButton icon={X} label={tr('إغلاق', 'Close')} onPress={onClose} size={38} />
        </View>
        {readers.map((r) => (
          <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable onPress={() => (onGo(r.page), onClose())} style={{ flex: 1, paddingVertical: 8 }} accessibilityRole="button" accessibilityLabel={tr(`انتقل إلى موضع ${r.name}`, `Go to ${r.name}’s place`)}>
              <Txt weight="medium">{r.name}</Txt>
              <Txt variant="caption" muted>
                {tr(`الصفحة ${r.page}`, `Page ${r.page}`)}
              </Txt>
            </Pressable>
            <IconButton icon={Check} label={tr(`وقف ${r.name} هنا`, `${r.name} stopped here`)} tone={r.page === page ? 'primary' : 'soft'} size={38} onPress={() => placeReader(r.name, page)} />
            <IconButton icon={Trash2} label={tr('حذف', 'Delete')} tone="plain" size={38} onPress={() => removeReader(r.id)} />
          </View>
        ))}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TextInput value={name} onChangeText={setName} onSubmitEditing={add} maxLength={30} placeholder={tr('اسم جديد، مثل: أمي', 'A new name, e.g. Mum')} placeholderTextColor={t.colors.textFaint} style={[inputStyle(t), { flex: 1 }]} />
          <IconButton icon={UserRoundPlus} label={tr('أضف واحفظ هذه الصفحة', 'Add and save this page')} tone="primary" onPress={add} />
        </View>
      </View>
    </Modal>
  );
}
