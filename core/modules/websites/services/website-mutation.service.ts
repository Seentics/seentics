import type {
  CreateWebsiteInput,
  UpdateWebsiteInput,
  Website,
  WebsiteMutations,
  WebsiteRepository,
} from "../interfaces";

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

  create(ownerId: string, input: CreateWebsiteInput): Promise<Website> {
    return this.repository.create(ownerId, input);
  }

  async update(websiteId: string, input: UpdateWebsiteInput): Promise<Website | null> {
    const updated = await this.repository.update(websiteId, input);
    if (updated) this.onChanged(websiteId);
    return updated;
  }

  async delete(websiteId: string): Promise<boolean> {
    await this.eraseData(websiteId);
    const deleted = await this.repository.delete(websiteId);
    if (deleted) this.onChanged(websiteId);
    return deleted;
  }
}
