import { useState, useCallback, useEffect } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

interface ToastState {
  toasts: Toast[]
}

const toastState: ToastState = {
  toasts: []
}

let listeners: Array<(state: ToastState) => void> = []

function dispatch(action: { type: string; toast?: Toast; toastId?: string }) {
  switch (action.type) {
    case 'ADD_TOAST':
      if (action.toast) {
        toastState.toasts = [...toastState.toasts, action.toast]
      }
      break
    case 'REMOVE_TOAST':
      toastState.toasts = toastState.toasts.filter(t => t.id !== action.toastId)
      break
    case 'DISMISS_TOAST':
      toastState.toasts = toastState.toasts.map(t =>
        t.id === action.toastId ? { ...t, open: false } : t
      )
      break
  }
  
  listeners.forEach(listener => listener(toastState))
}

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_VALUE
  return count.toString()
}

export function toast({ title, description, variant = 'default' }: Omit<Toast, 'id'>) {
  const id = genId()
  
  const toastItem: Toast = {
    id,
    title,
    description,
    variant
  }
  
  dispatch({ type: 'ADD_TOAST', toast: toastItem })
  
  // Auto dismiss after 5 seconds
  setTimeout(() => {
    dispatch({ type: 'REMOVE_TOAST', toastId: id })
  }, 5000)
  
  return {
    id,
    dismiss: () => dispatch({ type: 'REMOVE_TOAST', toastId: id })
  }
}

export function useToast() {
  const [state, setState] = useState<ToastState>(toastState)
  
  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  }, [])
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const unsubscribe = useCallback(() => {
    listeners = []
  }, [])
  
  // Subscribe to state changes
  useEffect(() => {
    const unsubscribe = subscribe(setState)
    return unsubscribe
  }, [subscribe])
  
  return {
    ...state,
    toast,
    dismiss: (toastId: string) => dispatch({ type: 'REMOVE_TOAST', toastId })
  }
}
