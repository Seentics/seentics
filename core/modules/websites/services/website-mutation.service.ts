import type {
  CreateWebsiteInput,
  UpdateWebsiteInput,
  Website,
  WebsiteMutations,
  WebsiteRepository,
} from "../interfaces";
import { log } from "../../../platform/observability/logger";

const website_log = log.child({ category: "websites" });

/** Website creation, settings updates, and deletion. */
export class WebsiteMutationService implements Pick<WebsiteMutations, "create" | "update" | "delete"> {
  constructor(
    private readonly repository: WebsiteRepository,
    private readonly onChanged: (websiteId: string) => void,
    /**
     * Erases everything the website collected, across every module, before the website
     * itself goes — supplied by the composition root, which is where knowledge of every
     * module's tables and stored files is allowed to meet.
     */
    private readonly eraseData: (websiteId: string) => Promise<void> = async () => {},
  ) {}

  async create(ownerId: string, input: CreateWebsiteInput): Promise<Website> {
    const website = await this.repository.create(ownerId, input);
    website_log.info({ msg: "website_created", website_id: website.id, owner_id: ownerId });
    return website;
  }

  async update(websiteId: string, input: UpdateWebsiteInput): Promise<Website | null> {
    const updated = await this.repository.update(websiteId, input);
    if (updated) {
      this.onChanged(websiteId);
      // Which settings, not their values: a domain or a privacy choice is the owner's business.
      website_log.info({ msg: "website_updated", website_id: websiteId, fields: Object.keys(input) });
    }
    return updated;
  }

  async delete(websiteId: string): Promise<boolean> {
    const started = Date.now();
    await this.eraseData(websiteId);
    const deleted = await this.repository.delete(websiteId);
    if (deleted) {
      this.onChanged(websiteId);
      website_log.info({ msg: "website_deleted", website_id: websiteId, erase_ms: Date.now() - started });
    }
    return deleted;
  }
}
