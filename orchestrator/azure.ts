import fetch, { RequestInit, Response } from "node-fetch";
import * as msRestNodeAuth from "@azure/ms-rest-nodeauth";
import { sleep } from "./util";

const SUBSCRIPTION_ID = process.env.SUBSCRIPTION_ID;
const RESOURCE_GROUP_NAME = process.env.RESOURCE_GROUP;

export class AzureCloud {
  private token: string = "";

  public async startVM(
    name: string,
    flavor: string,
    image: string
  ): Promise<string> {
    const response1 = await this.fetch(
      `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Network/networkInterfaces/${name}?api-version=2018-06-01`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: "westus2",
          properties: {
            ipConfigurations: [
              {
                name: "ipconfig1",
                properties: {
                  subnet: {
                    id: `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Network/virtualNetworks/${RESOURCE_GROUP_NAME}/subnets/default`,
                  },
                },
              },
            ],
          },
        }),
      }
    );
    if (!response1.ok) {
      console.error(await response1.text());
      throw Error(response1.statusText);
    }
    const network: any = await response1.json();

    const response = await this.fetch(
      `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Compute/virtualMachines/${name}?api-version=2018-06-01`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location: "westus2",
          name: name,
          properties: {
            hardwareProfile: {
              vmSize: "Standard_A4_v2",
            },
            storageProfile: {
              imageReference: {
                id: `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Compute/images/Ubuntu-with-docker`,
              },
            },
            networkProfile: {
              networkInterfaces: [
                {
                  id: network.id,
                },
              ],
            },
            osProfile: {
              adminUsername: "ubuntu",
              computerName: name,
              adminPassword: "Never_used0",
            },
          },
        }),
      }
    );
    if (!response.ok) {
      console.error(await response.text());
      throw Error(response.statusText);
    }
    //const server = await response.json()
    return name;
  }

  public async getVM(name: string): Promise<string | null> {
    const response = await this.fetch(
      `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Compute/virtualMachines?api-version=2018-06-01`,
      {
        method: "GET",
      }
    );
    if (!response.ok) {
      console.error(await response.text());
      throw Error(response.statusText);
    }
    const servers: any = await response.json();
    for (const vm of servers.value) {
      if (vm.name === name) {
        return vm.name; // id == name
      }
    }
    return null;
  }

  public async destroyVM(id: string) {
    // TODO
  }

  public async getIP(serverID: string): Promise<string> {
    const response = await this.fetch(
      `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Compute/virtualMachines/${serverID}?api-version=2018-06-01`,
      {}
    );
    if (!response.ok) {
      console.error(await response.text());
      throw Error(response.statusText);
    }
    const server: any = await response.json();
    const networkID = server.properties.networkProfile.networkInterfaces[0].id;
    const parts = networkID.split("/");
    const interfaceName = parts[parts.length - 1];

    let ip = "";
    while (ip === "") {
      const response = await this.fetch(
        `https://management.azure.com/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP_NAME}/providers/Microsoft.Network/networkInterfaces/${interfaceName}/ipConfigurations/ipconfig1?api-version=2018-06-01`,
        {}
      );
      if (!response.ok) {
        console.error(await response.text());
        throw Error(response.statusText);
      }
      const server: any = await response.json();
      if (server.properties.provisioningState === "Succeeded") {
        ip = server.properties.privateIPAddress;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
    }
    return ip;
  }

  private async fetch(url: string, init: RequestInit): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${this.token}`,
      },
    });
    if (response.status === 401) {
      await sleep(Math.random() * 5); // otherwise error: Temporarily throttled, too many requests
      const auth = await msRestNodeAuth.loginWithVmMSI();
      const token = await auth.getToken();
      this.token = token.accessToken;
      return this.fetch(url, init);
    } else {
      return response;
    }
  }
}
