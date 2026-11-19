import 'server-only';
import { env, simulatorAllowed } from '@/lib/env';
import { MoyasarGateway } from './moyasar';
import { SimulatorGateway } from './simulator';
import type { PaymentGateway } from './types';

export function gatewayFor(provider: string): PaymentGateway {
  if (provider === 'simulator') {
    if (!simulatorAllowed()) throw new Error('The payment simulator is disabled in this environment');
    return new SimulatorGateway();
  }
  if (provider === 'moyasar') return new MoyasarGateway(env.moyasarSecretKey ?? '');
  throw new Error(`Unknown payment provider ${provider}`);
}

export function activeProvider(): 'moyasar' | 'simulator' {
  return simulatorAllowed() ? 'simulator' : 'moyasar';
}

export function paymentsConfigured(): boolean {
  if (simulatorAllowed()) return true;
  return Boolean(env.moyasarPublishableKey && env.moyasarSecretKey);
}
