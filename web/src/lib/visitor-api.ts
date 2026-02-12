
// Firebase imports and functions commented out - not currently in use
// These functions are not used anywhere in the codebase
/*
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type Visitor = {
  id: string;
  tags?: string[];
  createdAt: any;
  lastSeenAt: any;
};

// Function to get a visitor's data
export async function getVisitor(visitorId: string): Promise<Visitor | null> {
  const visitorRef = doc(db, 'visitors', visitorId);
  const docSnap = await getDoc(visitorRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Visitor;
  }
  return null;
}

// Function to add a tag to a visitor
export async function addTagToVisitor(visitorId: string, tag: string): Promise<void> {
  const visitorRef = doc(db, 'visitors', visitorId);
  try {
    const docSnap = await getDoc(visitorRef);
    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(visitorRef, {
        tags: arrayUnion(tag),
        lastSeenAt: serverTimestamp(),
      });
    } else {
      // Document does not exist, create it
      await setDoc(visitorRef, {
        tags: [tag],
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
      });
    }
    console.log(`Tag "${tag}" added to visitor "${visitorId}"`);
  } catch (error) {
    console.error('Error adding tag to visitor:', error);
    throw error;
  }
}

// Function to remove a tag from a visitor
export async function removeTagFromVisitor(visitorId: string, tag: string): Promise<void> {
  const visitorRef = doc(db, 'visitors', visitorId);
  try {
    // We only need to update if the document exists. If it doesn't, there are no tags to remove.
    await updateDoc(visitorRef, {
      tags: arrayRemove(tag),
      lastSeenAt: serverTimestamp(),
    });
    console.log(`Tag "${tag}" removed from visitor "${visitorId}"`);
  } catch (error) {
    // It might throw an error if the document doesn't exist, which is fine.
    // We can just log it for debugging but not re-throw.
    console.warn(`Could not remove tag "${tag}" from visitor "${visitorId}":`, error);
  }
}
*/
