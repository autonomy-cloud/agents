import * as vscode from 'vscode';
import type { ChatMessage } from './openaiTypes';

// The Language Model API has no system role -- fold every system message
// into a single synthetic leading exchange instead of dropping it.
function toLmMessages(messages: ChatMessage[]): vscode.LanguageModelChatMessage[] {
  const systemText = messages
    .filter((m) => m.role === 'system' && m.content)
    .map((m) => m.content)
    .join('\n\n');

  const lmMessages: vscode.LanguageModelChatMessage[] = [];
  if (systemText) {
    lmMessages.push(vscode.LanguageModelChatMessage.User(`Instructions:\n${systemText}`));
    lmMessages.push(vscode.LanguageModelChatMessage.Assistant('Understood.'));
  }

  for (const message of messages) {
    if (message.role === 'system' || !message.content) {
      continue;
    }
    // `tool` results have no first-class LM API equivalent here (see
    // README's "Known limitations") -- surface them as labelled user
    // context rather than silently dropping them.
    if (message.role === 'assistant') {
      lmMessages.push(vscode.LanguageModelChatMessage.Assistant(message.content));
    } else {
      const label = message.role === 'tool' ? `[tool result: ${message.name ?? 'unknown'}]\n` : '';
      lmMessages.push(vscode.LanguageModelChatMessage.User(label + message.content));
    }
  }

  return lmMessages;
}

export class CopilotClient {
  private cachedModel: vscode.LanguageModelChat | undefined;

  constructor(private readonly log: (line: string) => void) {}

  get selectedModel(): vscode.LanguageModelChat | undefined {
    return this.cachedModel;
  }

  /** Must be called from a user-initiated action (a command handler) the
   * first time, so Copilot's own consent prompt attaches to something the
   * user actually clicked -- see VS Code's Language Model API guide. */
  async listModels(selector: vscode.LanguageModelChatSelector): Promise<vscode.LanguageModelChat[]> {
    const models = await vscode.lm.selectChatModels(selector);
    this.log(`Found ${models.length} model(s) for selector ${JSON.stringify(selector)}`);
    return models;
  }

  async ensureModel(selector: vscode.LanguageModelChatSelector): Promise<vscode.LanguageModelChat> {
    if (this.cachedModel) {
      return this.cachedModel;
    }
    const models = await this.listModels(selector);
    if (models.length === 0) {
      throw new Error(
        `No Copilot chat model matched ${JSON.stringify(selector)}. Run "Copilot LLM Bridge: Select Model..." first.`,
      );
    }
    this.cachedModel = models[0];
    return this.cachedModel;
  }

  setModel(model: vscode.LanguageModelChat): void {
    this.cachedModel = model;
  }

  async *streamCompletion(
    messages: ChatMessage[],
    selector: vscode.LanguageModelChatSelector,
    token: vscode.CancellationToken,
  ): AsyncGenerator<string> {
    const model = await this.ensureModel(selector);
    const lmMessages = toLmMessages(messages);

    let response: vscode.LanguageModelChatResponse;
    try {
      response = await model.sendRequest(lmMessages, {}, token);
    } catch (err) {
      if (err instanceof vscode.LanguageModelError) {
        throw new Error(`Copilot model error (${err.code ?? 'unknown'}): ${err.message}`);
      }
      throw err;
    }

    for await (const fragment of response.text) {
      yield fragment;
    }
  }
}
