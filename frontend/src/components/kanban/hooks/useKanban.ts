import { useState, useCallback, useEffect } from 'react';
import { Events } from '@wailsio/runtime';
import * as KanbanService from '../../../../bindings/ltools/plugins/kanban/kanbanservice';
import { Board, Column, Card, Label, CardUpdate, Priority } from '../../../../bindings/ltools/plugins/kanban/models';
import { t } from '@/i18n';

export interface KanbanState {
  boards: Board[];
  currentBoard: Board | null;
  loading: boolean;
  error: string | null | undefined;
}

export interface UseKanbanReturn extends KanbanState {
  // Board operations
  loadBoards: () => Promise<void>;
  selectBoard: (boardId: string) => Promise<void>;
  createBoard: (name: string, description: string) => Promise<Board | null>;
  updateBoard: (id: string, name: string, description: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;

  // Column operations
  createColumn: (boardId: string, name: string) => Promise<Column | null>;
  updateColumn: (boardId: string, columnId: string, name: string) => Promise<void>;
  deleteColumn: (boardId: string, columnId: string) => Promise<void>;
  moveColumn: (boardId: string, columnId: string, newPosition: number) => Promise<void>;

  // Card operations
  createCard: (boardId: string, columnId: string, title: string, priority?: Priority) => Promise<Card | null>;
  updateCard: (boardId: string, columnId: string, cardId: string, updates: CardUpdate) => Promise<void>;
  deleteCard: (boardId: string, columnId: string, cardId: string) => Promise<void>;
  moveCard: (boardId: string, fromColumnId: string, toColumnId: string, cardId: string, newPosition: number) => Promise<void>;
  completeCard: (boardId: string, columnId: string, cardId: string) => Promise<void>;
  uncompleteCard: (boardId: string, columnId: string, cardId: string) => Promise<void>;

  // Label operations
  createLabel: (boardId: string, name: string, color: string) => Promise<Label | null>;
  updateLabel: (boardId: string, labelId: string, name: string, color: string) => Promise<void>;
  deleteLabel: (boardId: string, labelId: string) => Promise<void>;

  // Checklist operations
  addChecklistItem: (boardId: string, columnId: string, cardId: string, text: string) => Promise<void>;
  toggleChecklistItem: (boardId: string, columnId: string, cardId: string, itemId: string) => Promise<void>;
  removeChecklistItem: (boardId: string, columnId: string, cardId: string, itemId: string) => Promise<void>;
  updateChecklistItem: (boardId: string, columnId: string, cardId: string, itemId: string, text: string) => Promise<void>;

  // Utility
  getLabelById: (labelId: string) => Label | undefined;
  clearError: () => void;
}

export function useKanban(): UseKanbanReturn {
  const [state, setState] = useState<KanbanState>({
    boards: [],
    currentBoard: null,
    loading: false,
    error: null,
  });

  // Load all boards
  const loadBoards = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    try {
      const boards = await KanbanService.GetBoards();
      setState(prev => ({
        ...prev,
        boards: boards || [],
        loading: false,
        // Auto-select first board if none selected
        currentBoard: prev.currentBoard
          ? boards?.find(b => b.id === prev.currentBoard?.id) || boards?.[0] || null
          : boards?.[0] || null,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : t('加载看板失败'),
      }));
    }
  }, []);

  // Select a board
  const selectBoard = useCallback(async (boardId: string) => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      const board = await KanbanService.GetBoard(boardId);
      setState(prev => ({
        ...prev,
        currentBoard: board,
        loading: false,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : t('加载看板失败'),
      }));
    }
  }, []);

  // Board CRUD
  const createBoard = useCallback(async (name: string, description: string): Promise<Board | null> => {
    try {
      const result = await KanbanService.CreateBoard(name, description);
      if (result?.error) {
        setState(prev => ({ ...prev, error: result.error || null }));
        return null;
      }
      if (result?.board) {
        setState(prev => ({
          ...prev,
          boards: [...prev.boards, result.board!],
        }));
        return result.board;
      }
      return null;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('创建看板失败'),
      }));
      return null;
    }
  }, []);

  const updateBoard = useCallback(async (id: string, name: string, description: string) => {
    try {
      await KanbanService.UpdateBoard(id, name, description);
      setState(prev => ({
        ...prev,
        boards: prev.boards.map(b =>
          b.id === id ? { ...b, name, description } : b
        ),
        currentBoard: prev.currentBoard?.id === id
          ? { ...prev.currentBoard, name, description }
          : prev.currentBoard,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('更新看板失败'),
      }));
    }
  }, []);

  const deleteBoard = useCallback(async (id: string) => {
    try {
      await KanbanService.DeleteBoard(id);
      setState(prev => {
        const newBoards = prev.boards.filter(b => b.id !== id);
        return {
          ...prev,
          boards: newBoards,
          currentBoard: prev.currentBoard?.id === id
            ? newBoards[0] || null
            : prev.currentBoard,
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('删除看板失败'),
      }));
    }
  }, []);

  // Column CRUD
  const createColumn = useCallback(async (boardId: string, name: string): Promise<Column | null> => {
    try {
      const result = await KanbanService.CreateColumn(boardId, name);
      if (result?.error) {
        setState(prev => ({ ...prev, error: result.error }));
        return null;
      }
      if (result?.column) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId
            ? {
                ...prev.currentBoard,
                columns: [...prev.currentBoard.columns, result.column!],
              }
            : prev.currentBoard,
        }));
        return result.column;
      }
      return null;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('创建列失败'),
      }));
      return null;
    }
  }, []);

  const updateColumn = useCallback(async (boardId: string, columnId: string, name: string) => {
    try {
      await KanbanService.UpdateColumn(boardId, columnId, name);
      setState(prev => ({
        ...prev,
        currentBoard: prev.currentBoard?.id === boardId
          ? {
              ...prev.currentBoard,
              columns: prev.currentBoard.columns.map(c =>
                c.id === columnId ? { ...c, name } : c
              ),
            }
          : prev.currentBoard,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('更新列失败'),
      }));
    }
  }, []);

  const deleteColumn = useCallback(async (boardId: string, columnId: string) => {
    try {
      await KanbanService.DeleteColumn(boardId, columnId);
      setState(prev => ({
        ...prev,
        currentBoard: prev.currentBoard?.id === boardId
          ? {
              ...prev.currentBoard,
              columns: prev.currentBoard.columns.filter(c => c.id !== columnId),
            }
          : prev.currentBoard,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('删除列失败'),
      }));
    }
  }, []);

  const moveColumn = useCallback(async (boardId: string, columnId: string, newPosition: number) => {
    try {
      await KanbanService.MoveColumn(boardId, columnId, newPosition);
      // Refresh board to get updated positions
      const board = await KanbanService.GetBoard(boardId);
      if (board) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId ? board : prev.currentBoard,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('移动列失败'),
      }));
    }
  }, []);

  // Card CRUD
  const createCard = useCallback(async (boardId: string, columnId: string, title: string, priority?: Priority): Promise<Card | null> => {
    try {
      const result = priority
        ? await KanbanService.CreateCard(boardId, columnId, title, priority)
        : await KanbanService.CreateCard(boardId, columnId, title);
      if (result?.error) {
        setState(prev => ({ ...prev, error: result.error }));
        return null;
      }
      if (result?.card) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId
            ? {
                ...prev.currentBoard,
                columns: prev.currentBoard.columns.map(c =>
                  c.id === columnId
                    ? { ...c, cards: [...c.cards, result.card!] }
                    : c
                ),
              }
            : prev.currentBoard,
        }));
        return result.card;
      }
      return null;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('创建卡片失败'),
      }));
      return null;
    }
  }, []);

  const updateCard = useCallback(async (boardId: string, columnId: string, cardId: string, updates: CardUpdate) => {
    try {
      await KanbanService.UpdateCard(boardId, columnId, cardId, updates);
      // Refresh board data
      const board = await KanbanService.GetBoard(boardId);
      if (board) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId ? board : prev.currentBoard,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('更新卡片失败'),
      }));
    }
  }, []);

  const deleteCard = useCallback(async (boardId: string, columnId: string, cardId: string) => {
    try {
      await KanbanService.DeleteCard(boardId, columnId, cardId);
      setState(prev => ({
        ...prev,
        currentBoard: prev.currentBoard?.id === boardId
          ? {
              ...prev.currentBoard,
              columns: prev.currentBoard.columns.map(c =>
                c.id === columnId
                  ? { ...c, cards: c.cards.filter(card => card.id !== cardId) }
                  : c
              ),
            }
          : prev.currentBoard,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('删除卡片失败'),
      }));
    }
  }, []);

  const moveCard = useCallback(async (
    boardId: string,
    fromColumnId: string,
    toColumnId: string,
    cardId: string,
    newPosition: number
  ) => {
    try {
      await KanbanService.MoveCard(boardId, fromColumnId, toColumnId, cardId, newPosition);
      // Refresh board to get updated state
      const board = await KanbanService.GetBoard(boardId);
      if (board) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId ? board : prev.currentBoard,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('移动卡片失败'),
      }));
    }
  }, []);

  const completeCard = useCallback(async (boardId: string, columnId: string, cardId: string) => {
    try {
      await KanbanService.CompleteCard(boardId, columnId, cardId);
      const board = await KanbanService.GetBoard(boardId);
      if (board) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId ? board : prev.currentBoard,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('完成卡片失败'),
      }));
    }
  }, []);

  const uncompleteCard = useCallback(async (boardId: string, columnId: string, cardId: string) => {
    try {
      await KanbanService.UncompleteCard(boardId, columnId, cardId);
      const board = await KanbanService.GetBoard(boardId);
      if (board) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId ? board : prev.currentBoard,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('取消完成失败'),
      }));
    }
  }, []);

  // Label CRUD
  const createLabel = useCallback(async (boardId: string, name: string, color: string): Promise<Label | null> => {
    try {
      const result = await KanbanService.CreateLabel(boardId, name, color);
      if (result?.error) {
        setState(prev => ({ ...prev, error: result.error }));
        return null;
      }
      if (result?.label) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId
            ? {
                ...prev.currentBoard,
                labels: [...prev.currentBoard.labels, result.label!],
              }
            : prev.currentBoard,
        }));
        return result.label;
      }
      return null;
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('创建标签失败'),
      }));
      return null;
    }
  }, []);

  const updateLabel = useCallback(async (boardId: string, labelId: string, name: string, color: string) => {
    try {
      await KanbanService.UpdateLabel(boardId, labelId, name, color);
      setState(prev => ({
        ...prev,
        currentBoard: prev.currentBoard?.id === boardId
          ? {
              ...prev.currentBoard,
              labels: prev.currentBoard.labels.map(l =>
                l.id === labelId ? { ...l, name, color } : l
              ),
            }
          : prev.currentBoard,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('更新标签失败'),
      }));
    }
  }, []);

  const deleteLabel = useCallback(async (boardId: string, labelId: string) => {
    try {
      await KanbanService.DeleteLabel(boardId, labelId);
      setState(prev => ({
        ...prev,
        currentBoard: prev.currentBoard?.id === boardId
          ? {
              ...prev.currentBoard,
              labels: prev.currentBoard.labels.filter(l => l.id !== labelId),
              columns: prev.currentBoard.columns.map(c => ({
                ...c,
                cards: c.cards.map(card => ({
                  ...card,
                  labels: card.labels.filter(l => l !== labelId),
                })),
              })),
            }
          : prev.currentBoard,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('删除标签失败'),
      }));
    }
  }, []);

  // Checklist operations
  const addChecklistItem = useCallback(async (boardId: string, columnId: string, cardId: string, text: string) => {
    try {
      await KanbanService.AddChecklistItem(boardId, columnId, cardId, text);
      const board = await KanbanService.GetBoard(boardId);
      if (board) {
        setState(prev => ({
          ...prev,
          currentBoard: prev.currentBoard?.id === boardId ? board : prev.currentBoard,
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('添加检查项失败'),
      }));
    }
  }, []);

  const toggleChecklistItem = useCallback(async (boardId: string, columnId: string, cardId: string, itemId: string) => {
    try {
      await KanbanService.ToggleChecklistItem(boardId, columnId, cardId, itemId);
      setState(prev => {
        if (prev.currentBoard?.id !== boardId) return prev;
        return {
          ...prev,
          currentBoard: {
            ...prev.currentBoard,
            columns: prev.currentBoard.columns.map(c =>
              c.id === columnId
                ? {
                    ...c,
                    cards: c.cards.map(card =>
                      card.id === cardId
                        ? {
                            ...card,
                            checklists: card.checklists.map(item =>
                              item.id === itemId
                                ? { ...item, completed: !item.completed }
                                : item
                            ),
                          }
                        : card
                    ),
                  }
                : c
            ),
          },
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('切换检查项失败'),
      }));
    }
  }, []);

  const removeChecklistItem = useCallback(async (boardId: string, columnId: string, cardId: string, itemId: string) => {
    try {
      await KanbanService.RemoveChecklistItem(boardId, columnId, cardId, itemId);
      setState(prev => {
        if (prev.currentBoard?.id !== boardId) return prev;
        return {
          ...prev,
          currentBoard: {
            ...prev.currentBoard,
            columns: prev.currentBoard.columns.map(c =>
              c.id === columnId
                ? {
                    ...c,
                    cards: c.cards.map(card =>
                      card.id === cardId
                        ? {
                            ...card,
                            checklists: card.checklists.filter(item => item.id !== itemId),
                          }
                        : card
                    ),
                  }
                : c
            ),
          },
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('删除检查项失败'),
      }));
    }
  }, []);

  const updateChecklistItem = useCallback(async (boardId: string, columnId: string, cardId: string, itemId: string, text: string) => {
    try {
      await KanbanService.UpdateChecklistItem(boardId, columnId, cardId, itemId, text);
      setState(prev => {
        if (prev.currentBoard?.id !== boardId) return prev;
        return {
          ...prev,
          currentBoard: {
            ...prev.currentBoard,
            columns: prev.currentBoard.columns.map(c =>
              c.id === columnId
                ? {
                    ...c,
                    cards: c.cards.map(card =>
                      card.id === cardId
                        ? {
                            ...card,
                            checklists: card.checklists.map(item =>
                              item.id === itemId ? { ...item, text } : item
                            ),
                          }
                        : card
                    ),
                  }
                : c
            ),
          },
        };
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : t('更新检查项失败'),
      }));
    }
  }, []);

  // Utility functions
  const getLabelById = useCallback((labelId: string): Label | undefined => {
    return state.currentBoard?.labels.find(l => l.id === labelId);
  }, [state.currentBoard]);

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Load boards on mount
  useEffect(() => {
    loadBoards();
  }, [loadBoards]);

  // Listen for kanban events
  useEffect(() => {
    const events = [
      'kanban:board:created',
      'kanban:board:updated',
      'kanban:board:deleted',
      'kanban:column:created',
      'kanban:column:updated',
      'kanban:column:deleted',
      'kanban:card:created',
      'kanban:card:updated',
      'kanban:card:deleted',
      'kanban:card:moved',
    ];

    const unsubscribers: (() => void)[] = [];

    events.forEach(event => {
      const unsubscribe = Events.On(event, () => {
        // Refresh current board on any change
        if (state.currentBoard) {
          selectBoard(state.currentBoard.id);
        }
      });
      unsubscribers.push(unsubscribe);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [state.currentBoard, selectBoard]);

  return {
    ...state,
    loadBoards,
    selectBoard,
    createBoard,
    updateBoard,
    deleteBoard,
    createColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    createCard,
    updateCard,
    deleteCard,
    moveCard,
    completeCard,
    uncompleteCard,
    createLabel,
    updateLabel,
    deleteLabel,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    updateChecklistItem,
    getLabelById,
    clearError,
  };
}

// Re-export Priority for convenience
export { Priority };
