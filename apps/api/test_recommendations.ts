import { RecommendationService } from './src/core/recommendations/service';

async function main() {
    try {
        const res = await RecommendationService.getPersonalizedRecommendations({ limit: 1 });
        console.log('SUCCESS:', res.recommendations.length);
    } catch (err) {
        console.error('ERROR:', err);
    }
}
main();
