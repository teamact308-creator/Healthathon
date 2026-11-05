import test from 'node:test';
import assert from 'node:assert/strict';
import {cropBounds} from './prescription-crop.js';
test('cropping preserves source pixel coordinates for a selected instruction area',()=>{
 assert.deepEqual(cropBounds(1200,2000,{left:0,top:20,right:100,bottom:90}),{x:0,y:400,width:1200,height:1400});
 assert.deepEqual(cropBounds(1200,2000,{left:0,top:0,right:100,bottom:100}),{x:0,y:0,width:1200,height:2000});
});
test('empty, reversed and outside-image selections are rejected',()=>{
 for(const rect of [{left:10,top:0,right:5,bottom:100},{left:-1,top:0,right:100,bottom:100},{left:0,top:0,right:101,bottom:100},{left:0,top:50,right:100,bottom:50}]){
  assert.throws(()=>cropBounds(100,100,rect),/Choose a crop/);
 }
});
