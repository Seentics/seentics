import type {
  ContactBulkChange,
  ContactInput,
  ContactMutations,
  ContactPatch,
  ContactView,
  ImportResult,
  ImportRowInput,
  LeadSink,
} from "../interfaces";
import { normalizeTags, prepareImport } from "../lib/contact-import";
import { bulkUpdate, deleteContacts, importContacts, insertContact, updateContact } from "../repositories/contact.repository";
import { deleteSiteSubmission } from "../repositories/submission.repository";

/**
 * Changes the owner makes to contacts: add, edit, tag, delete, import.
 *
 * A contact deleted with its submissions takes their queued deliveries with it — the same
 * rule as erasing one submission: what the owner deleted must not still be sent.
 */
export class ContactMutationService implements ContactMutations {
  constructor(
    private readonly sink: Pick<LeadSink, "forget">,
    private readonly view: (websiteId: string, id: string) => Promise<ContactView | null>,
  ) {}

  async create(websiteId: string, input: ContactInput) {
    const created = await insertContact(websiteId, { ...input, tags: normalizeTags(input.tags) }, "manual");
    if ("exists" in created) return created;
    return { contact: (await this.view(websiteId, created.id))! };
  }

  async update(websiteId: string, id: string, patch: ContactPatch) {
    const changed = await updateContact(websiteId, id, patch.tags ? { ...patch, tags: normalizeTags(patch.tags) } : patch);
    return changed ? this.view(websiteId, id) : null;
  }

  bulk(websiteId: string, ids: readonly string[], change: ContactBulkChange) {
    return bulkUpdate(websiteId, ids, {
      ...change,
      add_tags: normalizeTags(change.add_tags),
      remove_tags: (change.remove_tags ?? []).map((t) => t.trim()).filter(Boolean),
    });
  }

  async remove(websiteId: string, ids: readonly string[], withSubmissions: boolean) {
    const { deleted, submissionIds } = await deleteContacts(websiteId, ids, withSubmissions);
    if (submissionIds.length) await this.sink.forget(websiteId, submissionIds);
    return deleted;
  }

  async import(websiteId: string, input: readonly ImportRowInput[], updateExisting: boolean): Promise<ImportResult> {
    const { rows, errors } = prepareImport(input);
    const { created, updated } = await importContacts(websiteId, rows, updateExisting);
    return { created, updated, skipped: rows.length - created - updated, errors };
  }

  async deleteSubmission(websiteId: string, submissionId: string) {
    const gone = await deleteSiteSubmission(websiteId, submissionId);
    if (gone) await this.sink.forget(websiteId, [submissionId]);
    return gone;
  }
}
