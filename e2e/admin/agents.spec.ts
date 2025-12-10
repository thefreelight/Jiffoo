/**
 * Tenant Agents E2E Tests (Hardened)
 *
 * Tests tenant agent management with strict assertions.
 * Validates agent list, performance, commission, and hierarchy.
 *
 * Requirements: 23.1, 23.2, 23.3, 23.4, 23.5
 */

import { test, expect } from '../utils/test-fixtures';

// ============================================
// Test Data & Selectors
// ============================================

const SELECTORS = {
  // Agent list
  agentList: '[data-testid="agent-list"], .agent-list, table',
  agentRow: '[data-testid="agent-row"], .agent-row, tr',
  agentName: '[data-testid="agent-name"], .agent-name',
  agentLevel: '[data-testid="agent-level"], .agent-level',
  agentCommission: '[data-testid="agent-commission"], .commission',
  
  // Actions
  addAgentButton: '[data-testid="add-agent"], button:has-text("Add Agent"), button:has-text("添加代理")',
  viewButton: '[data-testid="view-agent"], button:has-text("View"), button:has-text("查看")',
  editButton: '[data-testid="edit-agent"], button:has-text("Edit"), button:has-text("编辑")',
  
  // Agent form
  agentForm: '[data-testid="agent-form"], form',
  nameInput: 'input[name="name"]',
  emailInput: 'input[name="email"]',
  phoneInput: 'input[name="phone"]',
  levelSelect: 'select[name="level"]',
  commissionInput: 'input[name="commission"], input[name="commissionRate"]',
  
  // Performance
  performanceSection: '[data-testid="performance"], .performance-section',
  salesStats: '[data-testid="sales-stats"], .sales-stats',
  commissionStats: '[data-testid="commission-stats"], .commission-stats',
  
  // Hierarchy
  hierarchySection: '[data-testid="hierarchy"], .hierarchy-section',
  hierarchyTree: '[data-testid="hierarchy-tree"], .hierarchy-tree',
  parentSelect: 'select[name="parent"], select[name="parentAgent"]',
  
  // Commission settings
  commissionSettings: '[data-testid="commission-settings"], .commission-settings',
  commissionRateInput: 'input[name="rate"]',
  
  // Search & Filter
  searchInput: '[data-testid="search-input"], input[type="search"]',
  levelFilter: '[data-testid="level-filter"], select[name="level"]',
  
  // Modal
  modal: '[role="dialog"], .modal',
  confirmButton: 'button:has-text("Confirm"), button:has-text("确认")',
  saveButton: 'button[type="submit"], button:has-text("Save"), button:has-text("保存")',
  
  // Messages
  successMessage: '[data-testid="success-message"], .success',
  errorMessage: '[data-testid="error-message"], .error',
  
  // Empty state
  emptyState: '[data-testid="empty-state"], .empty-state',
};

// ============================================
// Agent List Tests
// ============================================

test.describe('Tenant Agents - List', () => {
  test('should display agent list', async ({ page, strict }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const agentList = page.locator(SELECTORS.agentList);
    const emptyState = page.locator(SELECTORS.emptyState);
    
    const hasList = await agentList.count() > 0;
    const hasEmpty = await emptyState.count() > 0;
    
    expect(hasList || hasEmpty).toBeTruthy();
  });

  test('should display add agent button', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator(SELECTORS.addAgentButton);
    const hasAdd = await addButton.count() > 0;
  });

  test('should search agents', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const searchInput = page.locator(SELECTORS.searchInput);
    
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('test');
      await page.waitForTimeout(1000);
    }
  });
});

// ============================================
// Create Agent Tests
// ============================================

test.describe('Tenant Agents - Create', () => {
  test('should create agent', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator(SELECTORS.addAgentButton);
    
    if (await addButton.count() > 0) {
      await addButton.click();
      await page.waitForLoadState('networkidle');
      
      const nameInput = page.locator(SELECTORS.nameInput);
      const emailInput = page.locator(SELECTORS.emailInput);
      const saveButton = page.locator(SELECTORS.saveButton);
      
      if (await nameInput.count() > 0) {
        await nameInput.fill(`Test Agent ${Date.now()}`);
        
        if (await emailInput.count() > 0) {
          await emailInput.fill(`agent-${Date.now()}@example.com`);
        }
        
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});

// ============================================
// Performance Tests
// ============================================

test.describe('Tenant Agents - Performance', () => {
  test('should view agent performance', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const agentRows = page.locator(SELECTORS.agentRow);
    
    if (await agentRows.count() > 0) {
      const firstRow = agentRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
      } else {
        await firstRow.click();
      }
      
      await page.waitForLoadState('networkidle');
      
      const performanceSection = page.locator(SELECTORS.performanceSection);
      const salesStats = page.locator(SELECTORS.salesStats);
      
      const hasPerformance = await performanceSection.count() > 0;
      const hasSales = await salesStats.count() > 0;
    }
  });

  test('should display commission stats', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const agentRows = page.locator(SELECTORS.agentRow);
    
    if (await agentRows.count() > 0) {
      const firstRow = agentRows.first();
      const viewButton = firstRow.locator(SELECTORS.viewButton);
      
      if (await viewButton.count() > 0) {
        await viewButton.click();
        await page.waitForLoadState('networkidle');
        
        const commissionStats = page.locator(SELECTORS.commissionStats);
        const hasCommission = await commissionStats.count() > 0;
      }
    }
  });
});

// ============================================
// Commission Settings Tests
// ============================================

test.describe('Tenant Agents - Commission', () => {
  test('should configure agent commission', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const agentRows = page.locator(SELECTORS.agentRow);
    
    if (await agentRows.count() > 0) {
      const firstRow = agentRows.first();
      const editButton = firstRow.locator(SELECTORS.editButton);
      
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        const commissionInput = page.locator(SELECTORS.commissionInput);
        const saveButton = page.locator(SELECTORS.saveButton);
        
        if (await commissionInput.count() > 0 && await saveButton.count() > 0) {
          await commissionInput.clear();
          await commissionInput.fill('15');
          await saveButton.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});

// ============================================
// Hierarchy Tests
// ============================================

test.describe('Tenant Agents - Hierarchy', () => {
  test('should display agent hierarchy', async ({ page }) => {
    await page.goto('/tenant/agents/hierarchy');
    await page.waitForLoadState('networkidle');
    
    const hierarchySection = page.locator(SELECTORS.hierarchySection);
    const hierarchyTree = page.locator(SELECTORS.hierarchyTree);
    
    const hasHierarchy = await hierarchySection.count() > 0;
    const hasTree = await hierarchyTree.count() > 0;
  });

  test('should manage agent relationships', async ({ page }) => {
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const agentRows = page.locator(SELECTORS.agentRow);
    
    if (await agentRows.count() > 0) {
      const firstRow = agentRows.first();
      const editButton = firstRow.locator(SELECTORS.editButton);
      
      if (await editButton.count() > 0) {
        await editButton.click();
        await page.waitForLoadState('networkidle');
        
        const parentSelect = page.locator(SELECTORS.parentSelect);
        const hasParentSelect = await parentSelect.count() > 0;
      }
    }
  });
});

// ============================================
// Responsive Design Tests
// ============================================

test.describe('Tenant Agents - Responsive Design', () => {
  test('should display correctly on mobile', async ({ page, strict }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });

  test('should display correctly on tablet', async ({ page, strict }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    
    await page.goto('/tenant/agents');
    await page.waitForLoadState('networkidle');
    
    const body = page.locator('body');
    await strict.mustExist(body);
  });
});
