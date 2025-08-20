import React, { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { applySmartEditing } from '../services/smartEditService';
import { t } from '../utils/i18n';
import logger from '../utils/logger';

/**
 * Smart Edit Button Component
 * Provides a button to trigger AI-powered smart editing
 */
const SmartEditButton: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  
  // Handle smart edit button click
  const handleSmartEdit = async () => {
    logger.info('Smart edit button clicked');
    try {
      setIsLoading(true);
      await applySmartEditing();
    } catch (error) {
      logger.error(`Smart editing failed: ${error}`);
      // Could add a toast notification here
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <button 
      className={`smart-edit-button ${isLoading ? 'loading' : ''}`}
      onClick={handleSmartEdit}
      disabled={isLoading}
      title={t('smartEdit')}
    >
      <Wand2 size={16} />
      <span>{isLoading ? t('processing') : t('smartEdit')}</span>
    </button>
  );
};

export default SmartEditButton;