// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { escapeCsvValue, exportDataAsCSV } from './csv-export';

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result)));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsText(blob);
  });
}

describe('escapeCsvValue', () => {
  test.each([
    [null, ''],
    [undefined, ''],
    ['', ''],
    ['hello', 'hello'],
    ['a,b', '"a,b"'],
    ['say "hi"', '"say ""hi"""'],
    ['line1\nline2', '"line1\nline2"'],
    [42, '42'],
    [0, '0'],
    [true, 'true'],
  ])('escapeCsvValue(%j) keeps the CSV syntax valid', (value, expected) => {
    expect(escapeCsvValue(value)).toBe(expected);
  });

  test('a number is never changed, even when it is negative', () => {
    expect(escapeCsvValue(-5)).toBe('-5');
    expect(escapeCsvValue(-1.5e-7)).toBe('-1.5e-7');
    expect(escapeCsvValue(-Infinity)).toBe('-Infinity');
  });

  test.each(['-5', '+3.2', '-1e-7', '-.5', '-5.', '-', '=', '+', '@', 'a=b', 'user@example.com', '1-2'])(
    'escapeCsvValue(%j) keeps a text that is not a formula',
    (value) => {
      expect(escapeCsvValue(value)).toBe(value);
    },
  );

  test.each([
    ['=1+1', `"'=1+1"`],
    ['+1+1', `"'+1+1"`],
    ['-1+1', `"'-1+1"`],
    ['@SUM(A1)', `"'@SUM(A1)"`],
    ['\t=1+1', `"'\t=1+1"`],
    ['\r=1+1', `"'\r=1+1"`],
    ['=A1&"x"', `"'=A1&""x"""`],
    ['-Inf', `"'-Inf"`],
    ['--- separator', `"'--- separator"`],
  ])('escapeCsvValue(%j) writes as a text a value read as a formula', (value, expected) => {
    expect(escapeCsvValue(value)).toBe(expected);
  });

  test('a very long value made of digits is handled quickly', () => {
    const value = `-${'1'.repeat(200000)}x`;

    expect(escapeCsvValue(value)).toBe(`"'${value}"`);
  });
});

describe('exportDataAsCSV', () => {
  test('writes one column per series and one row per timestamp, sorted by time', async () => {
    const blob = exportDataAsCSV({
      data: {
        series: [
          {
            name: 'up',
            values: [
              [1700000060000, 2],
              [1700000000000, 1],
            ],
          },
        ],
      },
    });

    expect(await readBlob(blob)).toBe('DateTime,up\n2023-11-14T22:13:20.000Z,1\n2023-11-14T22:14:20.000Z,2\n');
  });

  test('writes as a text a column name read as a formula', async () => {
    const blob = exportDataAsCSV({
      data: {
        series: [{ name: '=1+1', values: [[1700000000000, 1]] }],
      },
    });

    expect(await readBlob(blob)).toBe(`DateTime,"'=1+1"\n2023-11-14T22:13:20.000Z,1\n`);
  });
});
