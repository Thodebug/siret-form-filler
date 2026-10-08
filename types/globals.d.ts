// Minimal typings for the extension APIs and the shared content script
// namespace. Only what the code uses is declared.

type SffKind = 'siret' | 'siren';

interface SffDetection {
  kind: SffKind | null;
  scores: Record<SffKind, number>;
  blockScore: number;
}

interface SiretFormFillerNamespace {
  numbers?: {
    LA_POSTE_SIREN: string;
    isLuhnValid(digits: string): boolean;
    luhnCheckDigit(partial: string): string;
    generateSiren(): string;
    generateSiret(): string;
  };
  detection?: {
    normalize(text: string): string;
    scanKeywords(text: string): { siret: boolean; siren: boolean; blocked: boolean };
    patternKind(pattern: string): SffKind | null;
    isEligible(element: Element | null | undefined): element is HTMLInputElement;
    detectField(element: Element | null | undefined): SffDetection;
  };
  fill?: {
    digitsOf(text: string): string;
    fillField(field: HTMLInputElement, value: string): 'insertText' | 'assignment';
  };
}

interface SffMenuCreateProperties {
  id: string;
  title: string;
  contexts: string[];
  visible: boolean;
}

interface SffMenuUpdateProperties {
  visible: boolean;
  title?: string;
}

interface SffEvent<Listener> {
  addListener(listener: Listener): void;
}

interface SffMenusApi {
  create(properties: SffMenuCreateProperties, callback?: () => void): void;
  update(id: string, properties: SffMenuUpdateProperties): Promise<void>;
  removeAll(): Promise<void>;
  refresh?(): Promise<void>;
  getTargetElement?(targetElementId: number): Element | null;
  onShown?: SffEvent<(info: any, tab: any) => void>;
  onHidden?: SffEvent<() => void>;
  onClicked: SffEvent<(info: any, tab: any) => void>;
}

interface SffExtensionApi {
  menus?: SffMenusApi;
  contextMenus?: SffMenusApi;
  dom?: { openOrClosedShadowRoot(element: HTMLElement): ShadowRoot | null };
  i18n: { getMessage(name: string): string };
  runtime: {
    lastError?: unknown;
    sendMessage(message: unknown): Promise<unknown> | undefined;
    onInstalled: SffEvent<() => void>;
    onStartup: SffEvent<() => void>;
    onMessage: SffEvent<
      (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => unknown
    >;
  };
  tabs: {
    sendMessage(tabId: number, message: unknown, options?: { frameId?: number }): Promise<any>;
  };
}

declare var SiretFormFiller: SiretFormFillerNamespace;
declare var SiretFormFillerContentLoaded: boolean | undefined;
declare var browser: SffExtensionApi | undefined;
declare var chrome: SffExtensionApi | undefined;
