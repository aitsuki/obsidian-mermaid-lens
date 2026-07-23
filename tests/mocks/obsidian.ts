let language = "zh-CN";

export function getLanguage(): string { return language; }
export function setLanguage(value: string): void { language = value; }

export class App {
  workspace: any;
  constructor(workspace: any = {}) { this.workspace = workspace; }
}

export class Modal {
  app: App;
  modalEl = document.createElement("div");
  contentEl = document.createElement("div");
  scope = { register: () => undefined };
  opened = false;

  constructor(app: App) { this.app = app; }
  open(): void { this.opened = true; this.onOpen?.(); }
  onOpen?(): void;
}

export function setIcon(element: HTMLElement, icon: string): void {
  element.dataset.icon = icon;
}

export const notices: string[] = [];
export class Notice {
  constructor(message: string) { notices.push(message); }
}

export class PluginSettingTab {
  containerEl = document.createElement("div");
  constructor(public app: App, public plugin: any) {}
}

class Component<T> {
  value?: T;
  onChangeHandler?: (value: T) => unknown;
  setValue(value: T): this { this.value = value; return this; }
  onChange(handler: (value: T) => unknown): this { this.onChangeHandler = handler; return this; }
}

export class TextAreaComponent extends Component<string> {
  inputEl = document.createElement("textarea");
  setPlaceholder(): this { return this; }
}
export class ButtonComponent {
  onClickHandler?: () => unknown;
  setButtonText(): this { return this; }
  setCta(): this { return this; }
  onClick(handler: () => unknown): this { this.onClickHandler = handler; return this; }
}
export class DropdownComponent extends Component<string> {
  addOption(): this { return this; }
}
export class ToggleComponent extends Component<boolean> {}

export const settingComponents: Array<TextAreaComponent | ButtonComponent | DropdownComponent | ToggleComponent> = [];

export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName(): this { return this; }
  setDesc(): this { return this; }
  addTextArea(callback: (component: TextAreaComponent) => unknown): this {
    const component = new TextAreaComponent(); settingComponents.push(component); callback(component); return this;
  }
  addButton(callback: (component: ButtonComponent) => unknown): this {
    const component = new ButtonComponent(); settingComponents.push(component); callback(component); return this;
  }
  addDropdown(callback: (component: DropdownComponent) => unknown): this {
    const component = new DropdownComponent(); settingComponents.push(component); callback(component); return this;
  }
  addToggle(callback: (component: ToggleComponent) => unknown): this {
    const component = new ToggleComponent(); settingComponents.push(component); callback(component); return this;
  }
}

export class MarkdownView {}

export class Plugin {
  app: any;
  private data: any;
  constructor(app: any = new App()) { this.app = app; }
  async loadData(): Promise<any> { return this.data; }
  async saveData(data: any): Promise<void> { this.data = data; }
  addSettingTab(): void {}
  registerMarkdownPostProcessor(): void {}
  registerEvent(): void {}
}

export async function loadMermaid(): Promise<never> {
  throw new Error("loadMermaid must be injected in tests");
}
