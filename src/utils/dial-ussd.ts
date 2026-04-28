/**
 * Utility to trigger a USSD call via the Android phone dialer.
 *
 * Opens the phone dialer with the USSD code pre-filled.
 * The user taps the call button to execute — no CALL_PHONE permission needed.
 */

import { Alert, Linking } from 'react-native';

/**
 * Opens the phone dialer with the given USSD code ready to execute.
 *
 * @param ussdCode - The USSD code, e.g. "*131*1*3*4#"
 * @param planName - Optional plan name for error messages
 */
export async function dialUSSD(
  ussdCode: string,
  planName?: string,
): Promise<void> {
  try {
    // Encode '#' as '%23' for the tel: URI scheme on Android
    const encoded = `tel:${ussdCode.replace(/#/g, '%23')}`;
    const canOpen = await Linking.canOpenURL(encoded);

    if (!canOpen) {
      Alert.alert(
        'Cannot Dial',
        `Your device cannot process USSD codes directly.\n\nTo purchase${planName ? ` ${planName}` : ''}, please open your phone dialer and enter:\n\n${ussdCode}`,
        [{ text: 'OK' }],
      );
      return;
    }

    await Linking.openURL(encoded);
  } catch (error) {
    Alert.alert(
      'Dial Error',
      `Could not open the dialer.\n\nPlease manually dial: ${ussdCode}`,
      [{ text: 'OK' }],
    );
  }
}
