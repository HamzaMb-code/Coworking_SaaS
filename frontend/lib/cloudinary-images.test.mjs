import assert from "node:assert/strict";
import test from "node:test";
import { cloudinaryImageSrcSet } from "./cloudinary-images.ts";

test("Cloudinary delivery URLs produce width-transformed srcset candidates", () => {
  const source = "https://res.cloudinary.com/demo/image/upload/f_auto/q_auto/v1/coworking/workspaces/sample?_a=test";
  const srcSet = cloudinaryImageSrcSet(source);

  assert.ok(srcSet);
  assert.match(srcSet, /\/image\/upload\/c_limit,w_64\/f_auto\/q_auto\/v1\/coworking\/workspaces\/sample\?_a=test 64w/);
  assert.match(srcSet, /\/image\/upload\/c_limit,w_2560\/f_auto\/q_auto\/v1\/coworking\/workspaces\/sample\?_a=test 2560w/);
  assert.equal(srcSet.split(", ").length, 10);
});

test("legacy local image URLs and upload previews do not get Cloudinary srcsets", () => {
  assert.equal(cloudinaryImageSrcSet("https://api.example.test/storage/workspaces/legacy.jpg"), undefined);
  assert.equal(cloudinaryImageSrcSet("/storage/workspaces/legacy.jpg"), undefined);
  assert.equal(cloudinaryImageSrcSet("blob:https://app.example.test/preview-id"), undefined);
});
