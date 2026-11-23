import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { addAdmin, fetchAdmins, removeAdmin, type AdminMember } from '@/data/admin';
import { confirmAction, errorMessage, showMessage } from '@/utils/feedback';

import { Action, adminStyles, Badge, LoadError, SectionHeading, type Loadable } from './admin-ui';

const loadAdmins = (): Promise<Loadable<AdminMember[]>> =>
  fetchAdmins().then((value) => ({ kind: 'ready' as const, value }), (error: unknown) => ({ kind: 'error' as const, message: errorMessage(error) }));

/** `onLeftTeam` runs after the signed-in admin removes themself, so the screen can lock again. */
export function TeamSection({ onLeftTeam }: { onLeftTeam: () => void }) {
  const [state, setState] = useState<Loadable<AdminMember[]>>({ kind: 'loading' });
  const [account, setAccount] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    let active = true;
    void loadAdmins().then((result) => { if (active) setState(result); });
    return () => { active = false; };
  }, []));

  const reload = () => void loadAdmins().then(setState);

  const add = async () => {
    if (!account.trim()) return showMessage('Enter an account', 'Type the email address or phone number the person signs in to Kwetu with.');
    setBusy(true);
    try {
      const label = await addAdmin(account);
      setAccount('');
      showMessage('Admin added', `${label} can now open the admin console by holding the KWETU logo on the home screen for 2 seconds.`);
      reload();
    } catch (error) {
      showMessage('Could not add admin', errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = (member: AdminMember) => confirmAction(
    member.isMe ? 'Remove yourself as admin?' : `Remove ${member.account}?`,
    member.isMe ? 'You will lose access to the admin console straight away. Another admin can add you back.' : 'They will no longer be able to review restaurants or look up orders.',
    'Remove',
    () => void (async () => {
      setBusy(true);
      try {
        await removeAdmin(member.userId);
        if (member.isMe) return onLeftTeam();
        reload();
      } catch (error) {
        showMessage('Could not remove admin', errorMessage(error));
      } finally {
        setBusy(false);
      }
    })(),
  );

  return <View>
    <SectionHeading helper="Admins can review restaurants, change ratings and tags, look up orders, and manage this list." loading={state.kind === 'loading'} onRefresh={reload} title="Admins" />
    {state.kind === 'error' && <LoadError message={state.message} onRetry={reload} />}
    {state.kind === 'ready' && state.value.map((member) => <View key={member.userId} style={adminStyles.card}>
      <View style={adminStyles.cardTop}>
        <View style={adminStyles.cardCopy}>
          <Text selectable style={adminStyles.name}>{member.account}</Text>
          <Text style={adminStyles.meta}>Admin since {new Date(member.addedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
        </View>
        {member.isMe && <Badge label="YOU" />}
      </View>
      {state.value.length > 1 && <View style={adminStyles.actions}><Action disabled={busy} label={member.isMe ? 'Leave admin team' : 'Remove'} onPress={() => remove(member)} secondary /></View>}
    </View>)}

    <View style={adminStyles.card}>
      <Text style={adminStyles.name}>Add an admin</Text>
      <Text style={adminStyles.meta}>They need a Kwetu account first. Ask them to sign up in the app, then enter the email or phone number they sign in with.</Text>
      <Text style={adminStyles.label}>EMAIL OR PHONE</Text>
      <TextInput
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect={false}
        editable={!busy}
        keyboardType="email-address"
        onChangeText={setAccount}
        onSubmitEditing={() => void add()}
        placeholder="name@example.com or 0712 345 678"
        style={adminStyles.input}
        value={account}
      />
      <View style={adminStyles.actions}><Action disabled={busy} label={busy ? 'Saving…' : 'Add admin'} onPress={() => void add()} /></View>
    </View>
  </View>;
}
