import {test,expect} from '@playwright/test';
test('API Studio documentée sans promesse de souscription active',async({page})=>{
 await page.goto('/developpeurs');
 await expect(page.getByRole('heading',{name:/Vérifiez les mentions commerciales depuis vos outils/i})).toBeVisible();
 await expect(page.getByText('API Studio en préparation commerciale.')).toBeVisible();
 await expect(page.getByText(/2 000 contrôles \/ mois/)).toBeVisible();
 await expect(page.getByText(/non comprise dans Solo ou Pro/)).toBeVisible();
 await expect(page.getByRole('link',{name:'Consulter la spécification OpenAPI 3.1'})).toHaveAttribute('href',/openapi\.yaml/);
});
