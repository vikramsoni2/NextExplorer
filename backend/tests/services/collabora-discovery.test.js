const test = require('node:test');
const assert = require('node:assert/strict');

const { parseDiscoveryXml } = require('../../src/services/collaboraDiscoveryService');

test('parseDiscoveryXml extracts actions by extension and decodes urlsrc', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <wopi-discovery>
      <net-zone name="external-https">
        <app name="writer">
          <action name="edit" ext="docx" urlsrc="https://office.example.com/loleaflet/123/loleaflet.html?WOPISrc="/>
          <action name="view" ext="docx" urlsrc="https://office.example.com/loleaflet/123/loleaflet.html?permission=readonly&amp;WOPISrc="/>
          <action name="edit" ext="ODT" urlsrc="https://office.example.com/loleaflet/123/loleaflet.html?foo=bar&amp;WOPISrc="/>
        </app>
      </net-zone>
    </wopi-discovery>`;

  const map = parseDiscoveryXml(xml);
  assert.ok(map instanceof Map);

  const docx = map.get('docx');
  assert.ok(docx);
  assert.equal(docx.edit, 'https://office.example.com/loleaflet/123/loleaflet.html?WOPISrc=');
  assert.equal(
    docx.view,
    'https://office.example.com/loleaflet/123/loleaflet.html?permission=readonly&WOPISrc='
  );

  const odt = map.get('odt');
  assert.ok(odt);
  assert.equal(
    odt.edit,
    'https://office.example.com/loleaflet/123/loleaflet.html?foo=bar&WOPISrc='
  );
});
