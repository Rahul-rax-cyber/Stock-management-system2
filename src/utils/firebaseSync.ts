/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  writeBatch 
} from 'firebase/firestore';
import { DailyLog, MasterItem } from '../types';
import { 
  getMasterItems, 
  saveMasterItems, 
  getLogDates, 
  saveDailyLog, 
  getDailyLog 
} from './storage';

// Sync local master items to Firestore
export async function syncMasterItemsToCloud(items: MasterItem[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    items.forEach((item) => {
      const docRef = doc(db, 'masterItems', item.id);
      batch.set(docRef, item);
    });
    await batch.commit();
    console.log('[Firebase Sync] Master items successfully synced to Cloud Firestore.');
  } catch (error) {
    console.error('[Firebase Sync] Failed to sync master items to cloud:', error);
    handleFirestoreError(error, OperationType.WRITE, 'masterItems');
  }
}

// Sync local daily log to Firestore
export async function syncDailyLogToCloud(log: DailyLog): Promise<void> {
  const path = `dailyLogs/${log.date}`;
  try {
    const docRef = doc(db, 'dailyLogs', log.date);
    // Convert to standard object to prevent any undefined fields in Firestore
    const logObj = JSON.parse(JSON.stringify(log));
    await setDoc(docRef, logObj);
    console.log(`[Firebase Sync] Daily log for ${log.date} synced to Cloud Firestore.`);
  } catch (error) {
    console.error(`[Firebase Sync] Failed to sync daily log ${log.date} to cloud:`, error);
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Full Sync: Fetch from Cloud Firestore and merge into local storage
export async function pullAndMergeCloudData(): Promise<{ success: boolean; masterCount: number; logsCount: number }> {
  try {
    // 1. Sync Master Items
    let masterSnapshot;
    try {
      masterSnapshot = await getDocs(collection(db, 'masterItems'));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'masterItems');
      throw err;
    }

    const cloudMasterItems: MasterItem[] = [];
    masterSnapshot.forEach((doc) => {
      cloudMasterItems.push(doc.data() as MasterItem);
    });

    if (cloudMasterItems.length > 0) {
      // Merge: imported cloud items take precedence
      const localMaster = getMasterItems();
      const mergedMaster = [...localMaster];

      cloudMasterItems.forEach((cloudItem) => {
        const idx = mergedMaster.findIndex((m) => m.id === cloudItem.id);
        if (idx > -1) {
          mergedMaster[idx] = cloudItem;
        } else {
          mergedMaster.push(cloudItem);
        }
      });
      saveMasterItems(mergedMaster);
    }

    // 2. Sync Daily Logs
    let logsSnapshot;
    try {
      logsSnapshot = await getDocs(collection(db, 'dailyLogs'));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'dailyLogs');
      throw err;
    }

    let mergedLogsCount = 0;
    
    logsSnapshot.forEach((doc) => {
      const cloudLog = doc.data() as DailyLog;
      if (cloudLog && cloudLog.date) {
        // Save using local storage wrapper so index is updated and excel html is generated
        saveDailyLog(cloudLog);
        mergedLogsCount++;
      }
    });

    // If cloud is empty, but we have local data, push local data up to cloud to initialize
    const localMaster = getMasterItems();
    if (cloudMasterItems.length === 0 && localMaster.length > 0) {
      await syncMasterItemsToCloud(localMaster);
    }

    const localDates = getLogDates();
    if (mergedLogsCount === 0 && localDates.length > 0) {
      for (const d of localDates) {
        const logObj = getDailyLog(d);
        await syncDailyLogToCloud(logObj);
      }
    }

    return {
      success: true,
      masterCount: Math.max(cloudMasterItems.length, localMaster.length),
      logsCount: Math.max(mergedLogsCount, localDates.length)
    };
  } catch (error) {
    console.error('[Firebase Sync] Pull sync failed:', error);
    return { success: false, masterCount: 0, logsCount: 0 };
  }
}
