import React, { useState, useCallback, useImperativeHandle, createRef } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const confirmDialogRef = createRef();

export const confirmDialog = {
  info: (title, message, onConfirm) => {
    confirmDialogRef.current?.show({
      title,
      message,
      variant: 'info',
      onConfirm,
    });
  },
  confirm: (title, message, onConfirm) => {
    confirmDialogRef.current?.show({
      title,
      message,
      variant: 'confirm',
      onConfirm,
    });
  },
  destructiveConfirm: (title, message, onConfirm, confirmLabel) => {
    confirmDialogRef.current?.show({
      title,
      message,
      variant: 'destructive',
      onConfirm,
      confirmLabel,
    });
  }
};

export function ConfirmDialogHost() {
  const [state, setState] = useState({
    visible: false,
    title: '',
    message: '',
    variant: 'info',
    confirmLabel: undefined,
  });
  
  // Storing callbacks in ref to avoid capturing stale closures
  // and keeping them out of React state if possible, though React state
  // works fine if we just pass them through.
  const [callbacks, setCallbacks] = useState({
    onConfirm: null,
  });

  useImperativeHandle(confirmDialogRef, () => ({
    show: (options) => {
      setState({
        visible: true,
        title: options.title || '',
        message: options.message || '',
        variant: options.variant || 'info',
        confirmLabel: options.confirmLabel,
      });
      setCallbacks({
        onConfirm: options.onConfirm || null,
      });
    },
    hide: () => {
      setState(prev => ({ ...prev, visible: false }));
    }
  }));

  const handleConfirm = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
    if (callbacks.onConfirm) {
      callbacks.onConfirm();
    }
  }, [callbacks.onConfirm]);

  const handleCancel = useCallback(() => {
    setState(prev => ({ ...prev, visible: false }));
  }, []);

  return (
    <ConfirmDialog
      visible={state.visible}
      title={state.title}
      message={state.message}
      variant={state.variant}
      confirmLabel={state.confirmLabel}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );
}
