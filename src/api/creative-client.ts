import { MetaApiClient } from './base-client.js';
import { MetaCreative } from '../types/index.js';

interface AdCreativesResponse {
  data: Array<{
    id: string;
    name: string;
    object_story_spec?: Record<string, unknown>;
    image_hash?: string;
    call_to_action?: { type: string };
  }>;
}

export class CreativeClient extends MetaApiClient {
  async getAdCreatives(adId: string): Promise<MetaCreative[]> {
    const fields = 'id,name,object_story_spec,image_hash,call_to_action';
    const response = await this.get<AdCreativesResponse>(`${adId}/adcreatives`, { fields });

    return response.data.map((item) => ({
      id: item.id,
      name: item.name,
      objectStorySpec: item.object_story_spec,
      imageHash: item.image_hash,
      callToAction: item.call_to_action,
    }));
  }
}
