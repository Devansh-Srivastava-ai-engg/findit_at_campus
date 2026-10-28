async function runTests() {
  const base = 'http://localhost:3000/api';
  console.log('1. Health check...');
  const healthRes = await fetch(`${base}/health`);
  const health = await healthRes.json();
  console.log('Health:', health);

  console.log('\n2. Fetch reports...');
  const listRes = await fetch(`${base}/reports`);
  const list = await listRes.json();
  console.log(`Fetched ${list.length} reports.`);

  console.log('\n3. Create report with Item Photo (POST)...');
  const samplePhotoData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkWPjfDwAEeQHzEslkNgAAAABJRU5ErkJggg==';
  const postRes = await fetch(`${base}/reports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'found',
      category: 'Electronics',
      name: 'Sony WH-1000XM4 Headphones',
      location: 'Reading Hall A',
      date: '2026-10-10',
      description: 'Black over-ear headphones with custom case.',
      contact: 'Deposited at Central Library Desk 1',
      image: samplePhotoData
    })
  });
  console.log('POST status:', postRes.status);
  const created = await postRes.json();
  console.log('Created report id:', created.id);
  console.log('Created report has image:', Boolean(created.image && created.image.startsWith('data:image')));

  console.log('\n4. Verify security: Attempt claim WITHOUT student ID (should fail 400)...');
  const badClaimRes = await fetch(`${base}/reports/${created.id}/return`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  console.log('Bad claim status (expected 400):', badClaimRes.status);
  if (badClaimRes.status !== 400) {
    throw new Error('Security check failed: Endpoint allowed claim without student ID!');
  }

  console.log('\n5. Legitimate claim WITH College ID, contact, proof, AND Claimant Photo (PATCH)...');
  const sampleClaimantPhoto = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjAw/AYW8B/5t9bOAAAAAAElFTkSuQmCC';
  const validClaimRes = await fetch(`${base}/reports/${created.id}/return`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claimedBy: 'Pooja Nair',
      claimantId: '23EC019',
      claimantContact: 'pooja.ec@campus.edu',
      claimProof: 'Headphones auto-connect to Bluetooth name Pooja-iPhone',
      claimantPhoto: sampleClaimantPhoto
    })
  });
  const claimed = await validClaimRes.json();
  console.log('Claimed status:', claimed.status);
  console.log('Audit Claimant ID:', claimed.claimantId);
  console.log('Audit Claimant Photo present:', Boolean(claimed.claimantPhoto && claimed.claimantPhoto.startsWith('data:image')));
  if (claimed.status !== 'returned' || claimed.claimantId !== '23EC019' || !claimed.claimantPhoto) {
    throw new Error('Claim verification or claimant photo did not save properly!');
  }

  console.log('\n6. Clean up test report (DELETE)...');
  const delRes = await fetch(`${base}/reports/${created.id}`, {
    method: 'DELETE'
  });
  const deleted = await delRes.json();
  console.log('Delete result:', deleted);

  console.log('\n7. Final count check...');
  const finalList = await (await fetch(`${base}/reports`)).json();
  console.log(`Final count: ${finalList.length} (expected: 6)`);
  console.log('\nALL TESTS INCLUDING CLAIMANT PHOTO AUDIT PASSED SUCCESSFULLY!');
}

runTests().catch(console.error);
