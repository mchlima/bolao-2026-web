// Minimal ambient types for the Google Identity Services client
// (https://accounts.google.com/gsi/client) — only what we use.
interface GsiIdConfiguration {
  client_id: string;
  callback: (response: { credential?: string }) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GsiButtonConfiguration {
  type?: 'standard' | 'icon';
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: number | string;
}

interface Window {
  google?: {
    accounts: {
      id: {
        initialize(config: GsiIdConfiguration): void;
        renderButton(parent: HTMLElement, config: GsiButtonConfiguration): void;
        prompt(): void;
      };
    };
  };
}
