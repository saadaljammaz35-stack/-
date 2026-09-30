import * as LocalAuthentication from 'expo-local-authentication';

/** Whether this device can actually gate the app behind a biometric check. */
export async function canUseBiometrics(): Promise<boolean> {
  const [hasHardware, isEnrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && isEnrolled;
}

/** Face ID / Touch ID, falling back to the device passcode. */
export async function authenticate(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'افتح ضَمان',
    cancelLabel: 'إلغاء',
    disableDeviceFallback: false,
  });
  return result.success;
}
