import { findNodeHandle, Platform } from 'react-native';

export const scrollToFirstError = (fieldOrder, errors, fieldRefs, scrollViewRef) => {
  if (!scrollViewRef || !scrollViewRef.current || !fieldRefs || !fieldRefs.current) return;

  const firstErrorKey = fieldOrder.find(key => errors[key]);
  
  if (firstErrorKey) {
    const fieldRef = fieldRefs.current[firstErrorKey];
    if (fieldRef) {
      
      // Web specific logic since DOM elements don't have measureLayout
      if (Platform.OS === 'web') {
        try {
          const scrollNode = scrollViewRef.current.getScrollableNode 
            ? scrollViewRef.current.getScrollableNode() 
            : scrollViewRef.current;
            
          const element = fieldRef;
          if (element && typeof element.getBoundingClientRect === 'function' && scrollNode && typeof scrollNode.getBoundingClientRect === 'function') {
            const fieldRect = element.getBoundingClientRect();
            const scrollRect = scrollNode.getBoundingClientRect();
            
            // Calculate relative Y position
            const relativeY = fieldRect.top - scrollRect.top + scrollNode.scrollTop;
            
            if (scrollViewRef.current.scrollTo) {
              scrollViewRef.current.scrollTo({ y: Math.max(0, relativeY - 20), animated: true });
            } else {
              scrollNode.scrollTo({ top: Math.max(0, relativeY - 20), behavior: 'smooth' });
            }
            
            setTimeout(() => {
              if (element.focus) {
                element.focus();
              }
            }, 300);
            return; // Web logic successful, exit early
          }
        } catch (e) {
          console.warn("Web scroll logic failed:", e);
        }
      }

      // Native iOS/Android logic
      const scrollNode = (scrollViewRef.current && scrollViewRef.current.getInnerViewNode) 
        ? scrollViewRef.current.getInnerViewNode() 
        : findNodeHandle(scrollViewRef.current);
        
      if (!scrollNode) return;

      if (typeof fieldRef.measureLayout === 'function') {
        // Use measureLayout to get the exact y position relative to the ScrollView content
        fieldRef.measureLayout(
          scrollNode,
          (x, y) => {
            scrollViewRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
            
            // Focus the input if it's focusable, delay to allow scroll animation
            setTimeout(() => {
              if (fieldRef.focus) {
                fieldRef.focus();
              }
            }, 300);
          },
          () => {
            console.warn('measureLayout failed for field:', firstErrorKey, 'falling back to measure');
            if (typeof fieldRef.measure === 'function') {
              fieldRef.measure((fx, fy, width, height, px, py) => {
                scrollViewRef.current.measure((sx, sy, sw, sh, spx, spy) => {
                  scrollViewRef.current.scrollTo({ y: Math.max(0, py - spy - 20), animated: true });
                });
              });
            }
          }
        );
      }
    }
  }
};
