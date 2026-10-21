import { App, Modal } from 'obsidian';

import { t } from './lang/helpers';

/** Remplace `window.confirm` — résout `true` seulement si l'utilisateur confirme. */
export function askConfirm(app: App, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const m = new SimpleConfirmModal(app, message, resolve);
    m.open();
  });
}

class SimpleConfirmModal extends Modal {
  private done = false;

  constructor(
    app: App,
    private message: string,
    private onSubmit: (confirmed: boolean) => void
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('p', { text: this.message });
    const row = contentEl.createDiv({ cls: 'pwc-open-mode-modal__row' });
    row
      .createEl('button', { text: 'OK', cls: 'mod-cta' })
      .addEventListener('click', () => {
        this.done = true;
        this.onSubmit(true);
        this.close();
      });
    row
      .createEl('button', { text: t('Cancel') })
      .addEventListener('click', () => {
        this.close();
      });
  }

  onClose(): void {
    if (!this.done) {
      this.onSubmit(false);
    }
    this.contentEl.empty();
  }
}
