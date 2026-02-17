import { expect, test } from '@playwright/test';
import { login } from '../helpers/auth';
import { navigateToSimulation } from '../helpers/fixtures';

/** Helper: select agent(s) in the multi-select AgentSelector and confirm. */
async function selectAgentsAndConfirm(
  page: import('@playwright/test').Page,
  count: number = 1,
) {
  const agentSelector = page.locator('velg-agent-selector');
  await expect(agentSelector).toBeVisible();

  // Wait for agent items to load
  const items = agentSelector.locator('.selector__item');
  await expect(items.first()).toBeVisible({ timeout: 10_000 });

  // Click the desired number of agents
  const total = await items.count();
  const toSelect = Math.min(count, total);
  for (let i = 0; i < toSelect; i++) {
    await items.nth(i).click();
  }

  // Click confirm button
  const confirmBtn = agentSelector.locator('.selector__confirm');
  await expect(confirmBtn).toBeEnabled();
  await confirmBtn.click();

  // Selector should close
  await expect(agentSelector).not.toBeVisible({ timeout: 5_000 });
}

/** Helper: ensure at least one conversation exists, return the chat view locator. */
async function ensureConversation(page: import('@playwright/test').Page) {
  const chatView = page.locator('velg-chat-view');
  await expect(chatView).toBeVisible();

  const conversationList = chatView.locator('velg-conversation-list');
  const firstConversation = conversationList.locator('.conversation').first();
  const hasConversations = await firstConversation.isVisible().catch(() => false);

  if (!hasConversations) {
    const newButton = chatView.locator('.sidebar__new-btn');
    await newButton.click();
    await selectAgentsAndConfirm(page, 1);
    // Wait for toast to confirm
    await expect(page.locator('velg-toast')).toContainText('Conversation started', {
      timeout: 5_000,
    });
  } else {
    await firstConversation.click();
  }

  return chatView;
}

test.describe('Chat View', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await navigateToSimulation(page, 'chat');
  });

  test('displays conversation list', async ({ page }) => {
    const chatView = page.locator('velg-chat-view');
    await expect(chatView).toBeVisible();

    // The conversation list sidebar should be visible
    const sidebar = chatView.locator('.sidebar');
    await expect(sidebar).toBeVisible();

    // The sidebar header with "Conversations" title
    const sidebarTitle = sidebar.locator('.sidebar__title');
    await expect(sidebarTitle).toBeVisible();
    await expect(sidebarTitle).toHaveText('Conversations');

    // The "+ New" button
    const newButton = sidebar.locator('.sidebar__new-btn');
    await expect(newButton).toBeVisible();
    await expect(newButton).toContainText('New');

    // The conversation list component
    const conversationList = chatView.locator('velg-conversation-list');
    await expect(conversationList).toBeVisible();
  });

  test('creates a new conversation by selecting an agent', async ({ page }) => {
    const chatView = page.locator('velg-chat-view');
    await expect(chatView).toBeVisible();

    // Click "+ New" to open multi-select agent selector
    const newButton = chatView.locator('.sidebar__new-btn');
    await newButton.click();

    // Select one agent and confirm
    await selectAgentsAndConfirm(page, 1);

    // Toast confirms creation
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText('Conversation started', { timeout: 5_000 });

    // New conversation should appear in the list and be selected
    const conversationList = chatView.locator('velg-conversation-list');
    const activeConversation = conversationList.locator('.conversation--active');
    await expect(activeConversation).toBeVisible();

    // Chat window header should show agent name
    const chatWindow = chatView.locator('velg-chat-window');
    const windowHeader = chatWindow.locator('.window__agent-name');
    await expect(windowHeader).toBeVisible();
  });

  test('creates a multi-agent group conversation', async ({ page }) => {
    const chatView = page.locator('velg-chat-view');
    await expect(chatView).toBeVisible();

    // Click "+ New" to open agent selector
    const newButton = chatView.locator('.sidebar__new-btn');
    await newButton.click();

    const agentSelector = page.locator('velg-agent-selector');
    await expect(agentSelector).toBeVisible();

    // Wait for items
    const items = agentSelector.locator('.selector__item');
    await expect(items.first()).toBeVisible({ timeout: 10_000 });
    const totalAgents = await items.count();

    if (totalAgents >= 2) {
      // Select 2 agents
      await items.nth(0).click();
      await items.nth(1).click();

      // Chips should show 2 selected
      const chips = agentSelector.locator('.selector__chip');
      await expect(chips).toHaveCount(2);

      // Confirm
      const confirmBtn = agentSelector.locator('.selector__confirm');
      await expect(confirmBtn).toBeEnabled();
      await confirmBtn.click();

      // Toast confirms group creation
      const toast = page.locator('velg-toast');
      await expect(toast).toContainText('Group conversation started', { timeout: 5_000 });

      // Chat window header should show multiple agent names
      const chatWindow = chatView.locator('velg-chat-window');
      const windowHeader = chatWindow.locator('.window__agent-name');
      await expect(windowHeader).toBeVisible();

      // Sub-info should mention "agents"
      const subInfo = chatWindow.locator('.window__sub-info');
      await expect(subInfo).toContainText('agents');
    } else {
      // Not enough agents for multi-agent test, skip gracefully
      test.skip();
    }
  });

  test('sends a message in a conversation', async ({ page }) => {
    const chatView = await ensureConversation(page);

    // Wait for chat window to be ready
    const chatWindow = chatView.locator('velg-chat-window');
    const messageInput = chatWindow.locator('velg-message-input');
    await expect(messageInput).toBeVisible();

    // Type and send a message
    const textarea = messageInput.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('Hello, this is a test message.');

    const sendButton = messageInput.locator('button');
    await expect(sendButton).toBeEnabled();
    await sendButton.click();

    // The message should appear in the message list (optimistic update)
    const messageList = chatWindow.locator('velg-message-list');
    await expect(messageList).toContainText('Hello, this is a test message.', {
      timeout: 5_000,
    });

    // The textarea should be cleared
    await expect(textarea).toHaveValue('');
  });

  test('receives AI response after sending a message', async ({ page }) => {
    const chatView = await ensureConversation(page);

    // Send a message
    const chatWindow = chatView.locator('velg-chat-window');
    const messageInput = chatWindow.locator('velg-message-input');
    await expect(messageInput).toBeVisible();

    const textarea = messageInput.locator('textarea');
    await textarea.fill('Tell me about yourself.');
    const sendButton = messageInput.locator('button');
    await sendButton.click();

    // User message should appear
    await expect(chatWindow.locator('velg-message-list')).toContainText(
      'Tell me about yourself.',
      { timeout: 5_000 },
    );

    // Typing indicator may appear
    const typingIndicator = chatWindow.locator('.window__typing-indicator');
    await expect(typingIndicator)
      .toBeVisible({ timeout: 10_000 })
      .catch(() => {
        /* may be fast */
      });

    // Wait for typing to finish
    await expect(typingIndicator).not.toBeVisible({ timeout: 30_000 });

    // Message input should be re-enabled
    await expect(textarea).toBeEnabled({ timeout: 5_000 });
  });

  test('archives a conversation', async ({ page }) => {
    await ensureConversation(page);

    const chatView = page.locator('velg-chat-view');
    const conversationList = chatView.locator('velg-conversation-list');

    // Hover over the first non-archived conversation to reveal action buttons
    const activeConversation = conversationList
      .locator('.conversation:not(:has(.conversation__status))')
      .first();
    await expect(activeConversation).toBeVisible();
    await activeConversation.hover();

    // Click the archive action button (first .conversation__action-btn)
    const actionButtons = activeConversation.locator('.conversation__action-btn');
    const archiveButton = actionButtons.first();
    await expect(archiveButton).toBeVisible();
    await expect(archiveButton).toContainText('Archive');
    await archiveButton.click();

    // Toast confirms archive
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText('archived', { timeout: 5_000 });

    // The conversation should show "Archived" status badge
    const archivedStatus = activeConversation.locator('.conversation__status');
    await expect(archivedStatus).toBeVisible();
    await expect(archivedStatus).toHaveText('Archived');
  });

  test('deletes a conversation', async ({ page }) => {
    await ensureConversation(page);

    const chatView = page.locator('velg-chat-view');
    const conversationList = chatView.locator('velg-conversation-list');

    // Hover over the first non-archived conversation
    const activeConversation = conversationList
      .locator('.conversation:not(:has(.conversation__status))')
      .first();
    await expect(activeConversation).toBeVisible();
    await activeConversation.hover();

    // Click the delete button (second .conversation__action-btn)
    const actionButtons = activeConversation.locator('.conversation__action-btn');
    const deleteButton = actionButtons.nth(1);
    await expect(deleteButton).toBeVisible();
    await expect(deleteButton).toContainText('Delete');
    await deleteButton.click();

    // Confirm dialog should appear
    const confirmDialog = page.locator('velg-confirm-dialog');
    await expect(confirmDialog).toBeVisible();

    // Click confirm
    const confirmBtn = confirmDialog.locator('[data-testid="confirm-button"]');
    await confirmBtn.click();

    // Toast confirms deletion
    const toast = page.locator('velg-toast');
    await expect(toast).toContainText('deleted', { timeout: 5_000 });
  });

  test('opens event picker from chat window', async ({ page }) => {
    const chatView = await ensureConversation(page);

    // The chat window should have the pin/events button in header actions
    const chatWindow = chatView.locator('velg-chat-window');
    const headerActions = chatWindow.locator('.window__header-actions');
    await expect(headerActions).toBeVisible();

    // Click the pin button to toggle events bar
    const pinButton = headerActions.locator('.window__action-btn').first();
    await pinButton.click();

    // Events bar should appear
    const eventsBar = chatWindow.locator('.window__events-bar');
    await expect(eventsBar).toBeVisible();

    // Click "Add Event" button in the events bar to open the picker
    const addEventBtn = eventsBar.locator('.window__action-btn');
    await addEventBtn.click();

    // Event picker should open
    const eventPicker = page.locator('velg-event-picker');
    await expect(eventPicker).toBeVisible();

    // Should have a search input and event list
    const searchInput = eventPicker.locator('.picker__search');
    await expect(searchInput).toBeVisible();
  });

  test('chat window shows portrait stack in header', async ({ page }) => {
    const chatView = await ensureConversation(page);

    // Chat window header should contain portrait stack
    const chatWindow = chatView.locator('velg-chat-window');
    const portraits = chatWindow.locator('.header__portraits');
    await expect(portraits).toBeVisible();

    // Should contain at least one portrait item or placeholder
    const portraitItems = portraits.locator(
      '.header__portrait-item, .header__portrait-placeholder',
    );
    await expect(portraitItems.first()).toBeVisible();
  });

  test('conversation list shows portraits', async ({ page }) => {
    await ensureConversation(page);

    const chatView = page.locator('velg-chat-view');
    const conversationList = chatView.locator('velg-conversation-list');

    // The first conversation should have a portrait or placeholder
    const firstConversation = conversationList.locator('.conversation').first();
    await expect(firstConversation).toBeVisible();

    const portrait = firstConversation.locator(
      '.conversation__portrait, .conversation__portrait-placeholder',
    );
    await expect(portrait.first()).toBeVisible();
  });
});
